import { supabase } from './supabase';
import { Driver, DriverProfile, RideRequestForDriver, DriverEarnings, DriverStats } from '@/types';

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

function coord(location: any, key: 'latitude' | 'longitude'): number {
  const shortKey = key === 'latitude' ? 'lat' : 'lng';
  const value = location?.[key] ?? location?.[shortKey];
  return typeof value === 'number' ? value : 0;
}

export class FirebaseDriverService {
  static async createDriver(userId: string, driverData: Partial<DriverProfile>): Promise<string> {
    const profile = {
      ...driverData,
      userId,
      rating: 5.0,
      totalRides: 0,
      isOnline: false,
      isVerified: false,
      earnings: { today: 0, thisWeek: 0, thisMonth: 0, total: 0 },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('drivers').upsert(profile).select('id').single();
    if (error) throw new Error(error.message);
    return data?.id ?? userId;
  }

  static async getDriver(driverId: string): Promise<DriverProfile | null> {
    const { data, error } = await supabase.from('drivers').select('*').eq('id', driverId).single();
    if (error || !data) return null;
    return data as DriverProfile;
  }

  static async updateDriver(driverId: string, updates: Partial<DriverProfile>): Promise<void> {
    const { error } = await supabase
      .from('drivers')
      .update({ ...updates, lastActiveAt: new Date().toISOString() })
      .eq('id', driverId);
    if (error) throw new Error(error.message);
  }

  static async updateDriverLocation(driverId: string, latitude: number, longitude: number): Promise<void> {
    const { error } = await supabase
      .from('drivers')
      .update({ location: { latitude, longitude }, lastActiveAt: new Date().toISOString() })
      .eq('id', driverId);
    if (error) throw new Error(error.message);
  }

  static async setDriverOnlineStatus(driverId: string, isOnline: boolean): Promise<void> {
    const { error } = await supabase
      .from('drivers')
      .update({ isOnline, lastActiveAt: new Date().toISOString() })
      .eq('id', driverId);
    if (error) throw new Error(error.message);
  }

  static async getNearbyDrivers(latitude: number, longitude: number, radiusKm = 10): Promise<Driver[]> {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('isOnline', true)
      .eq('isVerified', true);

    if (error || !data) return [];

    return data
      .filter((d: any) => {
        if (!d.location) return false;
        return calculateDistance(latitude, longitude, d.location.latitude, d.location.longitude) <= radiusKm;
      })
      .map((d: any) => {
        const distance = calculateDistance(latitude, longitude, d.location.latitude, d.location.longitude);
        return {
          id: d.id,
          name: d.name || '',
          rating: d.rating || 5.0,
          location: { latitude: d.location.latitude, longitude: d.location.longitude },
          carType: d.vehicle?.type || 'Standard',
          carModel: `${d.vehicle?.make || ''} ${d.vehicle?.model || ''}`,
          licensePlate: d.vehicle?.licensePlate || '',
          eta: Math.ceil((distance / 30) * 60),
          phone: d.phone || '',
        };
      })
      .sort((a: any, b: any) => a.eta - b.eta);
  }

  static async getPendingRideRequests(driverId: string): Promise<RideRequestForDriver[]> {
    const driver = await this.getDriver(driverId);
    if (!driver?.location) return [];

    const { data: rides, error } = await supabase
      .from('rides')
      .select('*, users!rides_userId_fkey(displayName, rating, phone, photoURL)')
      .eq('status', 'pending')
      .order('createdAt', { ascending: false })
      .limit(20);

    if (error || !rides) return [];
    return this.mapRidesToRequests(rides, driver);
  }

  static subscribeToRideRequests(
    driverId: string,
    callback: (requests: RideRequestForDriver[]) => void
  ): () => void {
    const channel = supabase
      .channel('pending-rides')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides', filter: 'status=eq.pending' },
        async () => {
          const driver = await this.getDriver(driverId);
          if (!driver?.location) { callback([]); return; }

          const { data: rides } = await supabase
            .from('rides')
            .select('*')
            .eq('status', 'pending')
            .order('createdAt', { ascending: false })
            .limit(20);

          callback(this.mapRidesToRequests(rides ?? [], driver));
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  private static mapRidesToRequests(rides: any[], driver: DriverProfile): RideRequestForDriver[] {
    const results: RideRequestForDriver[] = [];

    for (const ride of rides) {
      if (!ride.pickupLocation || !ride.dropoffLocation) continue;

      const pickupLat = coord(ride.pickupLocation, 'latitude');
      const pickupLng = coord(ride.pickupLocation, 'longitude');
      const dropoffLat = coord(ride.dropoffLocation, 'latitude');
      const dropoffLng = coord(ride.dropoffLocation, 'longitude');

      if (!driver.location) continue;
      const distanceToPickup = calculateDistance(
        driver.location.latitude, driver.location.longitude, pickupLat, pickupLng
      );

      if (distanceToPickup > 10) continue;

      const passenger = ride.users || {};
      results.push({
        id: ride.id,
        pickupLocation: { latitude: pickupLat, longitude: pickupLng },
        dropoffLocation: { latitude: dropoffLat, longitude: dropoffLng },
        pickupAddress: ride.pickupAddress || '',
        dropoffAddress: ride.dropoffAddress || '',
        rideType: ride.rideType || 'standard',
        price: ride.fare || 0,
        distance: ride.distance || 0,
        duration: ride.duration || 0,
        status: 'pending',
        passenger: {
          id: ride.userId,
          name: passenger.displayName || 'Passenger',
          rating: passenger.rating || 5.0,
          photo: passenger.photoURL,
          phone: passenger.phone || '',
        },
        estimatedEarnings: (ride.fare || 0) * 0.8,
        distanceToPickup,
        createdAt: ride.createdAt ? new Date(ride.createdAt) : new Date(),
      });
    }

    return results.sort((a, b) => a.distanceToPickup - b.distanceToPickup);
  }

  static async acceptRide(rideId: string, driverId: string): Promise<void> {
    const { error } = await supabase
      .from('rides')
      .update({ driverId, status: 'accepted', acceptedAt: new Date().toISOString() })
      .eq('id', rideId);
    if (error) throw new Error(error.message);
    await this.setDriverOnlineStatus(driverId, false);
  }

  static async declineRide(_rideId: string): Promise<void> {
    // No-op: driver simply doesn't accept
  }

  static async updateRideStatus(
    rideId: string,
    status: 'in_progress' | 'completed' | 'cancelled',
    driverId?: string
  ): Promise<void> {
    const updates: any = { status: status === 'in_progress' ? 'in-progress' : status };
    if (status === 'in_progress') updates.startedAt = new Date().toISOString();
    else if (status === 'completed') updates.completedAt = new Date().toISOString();
    else if (status === 'cancelled') updates.cancelledAt = new Date().toISOString();

    const { error } = await supabase.from('rides').update(updates).eq('id', rideId);
    if (error) throw new Error(error.message);

    if ((status === 'completed' || status === 'cancelled') && driverId) {
      await this.setDriverOnlineStatus(driverId, true);
    }
  }

  static async getDriverEarnings(driverId: string, limitCount = 50): Promise<DriverEarnings[]> {
    const { data, error } = await supabase
      .from('rides')
      .select('id, fare, completedAt, createdAt')
      .eq('driverId', driverId)
      .eq('status', 'completed')
      .order('completedAt', { ascending: false })
      .limit(limitCount);

    if (error || !data) return [];

    return data.map((ride: any) => {
      const amount = ride.fare || 0;
      const commission = amount * 0.2;
      return {
        id: ride.id,
        driverId,
        rideId: ride.id,
        amount,
        commission,
        netAmount: amount - commission,
        payoutStatus: 'completed',
        payoutDate: ride.completedAt ? new Date(ride.completedAt) : undefined,
        createdAt: new Date(ride.createdAt),
      };
    });
  }

  static async getDriverStats(driverId: string): Promise<DriverStats> {
    const { data, error } = await supabase
      .from('rides')
      .select('fare, completedAt, driverRating')
      .eq('driverId', driverId)
      .eq('status', 'completed');

    if (error || !data) return defaultStats();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalRides = 0, totalEarnings = 0, totalRating = 0;
    let todayEarnings = 0, weekEarnings = 0, monthEarnings = 0;

    for (const ride of data) {
      const amount = (ride.fare || 0) * 0.8;
      const completedAt = ride.completedAt ? new Date(ride.completedAt) : null;
      const rating = ride.driverRating || 0;

      totalRides++;
      totalEarnings += amount;
      if (rating > 0) totalRating += rating;

      if (completedAt) {
        if (completedAt >= today) todayEarnings += amount;
        if (completedAt >= weekStart) weekEarnings += amount;
        if (completedAt >= monthStart) monthEarnings += amount;
      }
    }

    return {
      totalRides,
      totalEarnings,
      averageRating: totalRides > 0 ? totalRating / totalRides : 5.0,
      acceptanceRate: 92,
      cancellationRate: 3,
      onlineHours: 156,
      completionRate: 97,
      todayEarnings,
      weekEarnings,
      monthEarnings,
    };
  }

  static subscribeToDriverProfile(
    driverId: string,
    callback: (profile: DriverProfile | null) => void
  ): () => void {
    const channel = supabase
      .channel(`driver-${driverId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers', filter: `id=eq.${driverId}` },
        (payload) => callback(payload.new as DriverProfile || null)
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  static calculateDistance = calculateDistance;
}

function defaultStats(): DriverStats {
  return {
    totalRides: 0, totalEarnings: 0, averageRating: 5.0,
    acceptanceRate: 0, cancellationRate: 0, onlineHours: 0,
    completionRate: 0, todayEarnings: 0, weekEarnings: 0, monthEarnings: 0,
  };
}
