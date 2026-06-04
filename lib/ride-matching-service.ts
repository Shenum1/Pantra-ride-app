import { DatabaseService, Ride, Driver } from './database-service';
import { supabase } from './supabase';

export interface RideMatchResult {
  rideId: string;
  driverId: string;
  estimatedArrival: number;
  distance: number;
}

export class RideMatchingService {
  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  static async findNearbyDrivers(
    latitude: number,
    longitude: number,
    radiusKm = 5,
    rideType = 'standard'
  ): Promise<Driver[]> {
    try {
      const drivers = await DatabaseService.query('drivers', [
        { field: 'status', operator: '==', value: 'available' },
        { field: 'vehicleType', operator: '==', value: rideType },
      ]);

      return (drivers as any[])
        .filter((d) => {
          if (!d.currentLocation) return false;
          return this.calculateDistance(latitude, longitude, d.currentLocation.lat, d.currentLocation.lng) <= radiusKm;
        })
        .map((d) => ({
          ...d,
          distanceToPickup: this.calculateDistance(latitude, longitude, d.currentLocation.lat, d.currentLocation.lng),
        }))
        .sort((a: any, b: any) => a.distanceToPickup - b.distanceToPickup) as (Driver & { distanceToPickup: number })[];
    } catch {
      return [];
    }
  }

  static async matchRideWithDriver(rideId: string): Promise<RideMatchResult | null> {
    try {
      const ride = (await DatabaseService.get('rides', rideId)) as any;
      if (!ride) throw new Error('Ride not found');

      const nearbyDrivers = await this.findNearbyDrivers(
        ride.pickupLocation.lat,
        ride.pickupLocation.lng,
        10,
        ride.rideType
      );

      if (nearbyDrivers.length === 0) return null;

      const bestDriver = nearbyDrivers[0] as any;
      const estimatedArrival = Math.ceil((bestDriver.distanceToPickup / 30) * 60);

      await DatabaseService.update('rides', rideId, { driverId: bestDriver.id, status: 'accepted', estimatedArrival });
      await DatabaseService.update('drivers', bestDriver.id!, { status: 'busy' });

      return { rideId, driverId: bestDriver.id!, estimatedArrival, distance: bestDriver.distanceToPickup };
    } catch {
      return null;
    }
  }

  static subscribeToRideUpdates(rideId: string, callback: (ride: Ride) => void): () => void {
    const channel = supabase
      .channel(`ride-${rideId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides', filter: `id=eq.${rideId}` },
        (payload) => { if (payload.new) callback(payload.new as Ride); }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  static subscribeToDriverLocation(
    driverId: string,
    callback: (location: { lat: number; lng: number }) => void
  ): () => void {
    const channel = supabase
      .channel(`driver-loc-${driverId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `id=eq.${driverId}` },
        (payload) => {
          const loc = (payload.new as any)?.location;
          if (loc) callback({ lat: loc.latitude ?? loc.lat, lng: loc.longitude ?? loc.lng });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  static subscribeToAvailableRides(_driverId: string, callback: (rides: Ride[]) => void): () => void {
    const channel = supabase
      .channel('available-rides')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides', filter: 'status=eq.pending' },
        async () => {
          const { data } = await supabase.from('rides').select('*').eq('status', 'pending');
          callback((data ?? []) as Ride[]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  static async cancelRide(rideId: string): Promise<void> {
    const ride = (await DatabaseService.get('rides', rideId)) as any;
    if (!ride) throw new Error('Ride not found');
    await DatabaseService.update('rides', rideId, { status: 'cancelled' });
    if (ride.driverId) await DatabaseService.update('drivers', ride.driverId, { status: 'available' });
  }

  static async completeRide(rideId: string): Promise<void> {
    const ride = (await DatabaseService.get('rides', rideId)) as any;
    if (!ride) throw new Error('Ride not found');
    await DatabaseService.update('rides', rideId, { status: 'completed' });
    if (ride.driverId) await DatabaseService.update('drivers', ride.driverId, { status: 'available' });
  }
}
