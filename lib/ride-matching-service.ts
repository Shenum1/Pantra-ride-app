import { DatabaseService, Ride, Driver } from './database-service';
import { onSnapshot, collection, query, where, doc } from 'firebase/firestore';
import { db } from './firebase';

export interface RideMatchResult {
  rideId: string;
  driverId: string;
  estimatedArrival: number;
  distance: number;
}

export class RideMatchingService {
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static async findNearbyDrivers(
    latitude: number,
    longitude: number,
    radiusKm: number = 5,
    rideType: string = 'standard'
  ): Promise<Driver[]> {
    try {
      const drivers = await DatabaseService.query(
        'drivers',
        [
          { field: 'status', operator: '==', value: 'available' },
          { field: 'vehicleType', operator: '==', value: rideType }
        ]
      );

      const nearbyDrivers = drivers
        .filter((driver: any) => {
          if (!driver.currentLocation) return false;
          const distance = this.calculateDistance(
            latitude,
            longitude,
            driver.currentLocation.lat,
            driver.currentLocation.lng
          );
          return distance <= radiusKm;
        })
        .map((driver: any) => ({
          ...driver,
          distanceToPickup: this.calculateDistance(
            latitude,
            longitude,
            driver.currentLocation.lat,
            driver.currentLocation.lng
          )
        }))
        .sort((a: any, b: any) => a.distanceToPickup - b.distanceToPickup);

      return nearbyDrivers as (Driver & { distanceToPickup: number })[];
    } catch (error) {
      console.error('Error finding nearby drivers:', error);
      return [];
    }
  }

  static async matchRideWithDriver(rideId: string): Promise<RideMatchResult | null> {
    try {
      const ride = await DatabaseService.get('rides', rideId) as any;
      if (!ride) {
        throw new Error('Ride not found');
      }

      const nearbyDrivers = await this.findNearbyDrivers(
        ride.pickupLocation.lat,
        ride.pickupLocation.lng,
        10,
        ride.rideType
      );

      if (nearbyDrivers.length === 0) {
        console.log('No drivers available');
        return null;
      }

      const bestDriver = nearbyDrivers[0] as any;
      const estimatedArrival = Math.ceil((bestDriver.distanceToPickup / 30) * 60);

      await DatabaseService.update('rides', rideId, {
        driverId: bestDriver.id,
        status: 'accepted',
        estimatedArrival
      });

      await DatabaseService.update('drivers', bestDriver.id!, {
        status: 'busy'
      });

      return {
        rideId,
        driverId: bestDriver.id!,
        estimatedArrival,
        distance: bestDriver.distanceToPickup
      };
    } catch (error) {
      console.error('Error matching ride with driver:', error);
      return null;
    }
  }

  static subscribeToRideUpdates(
    rideId: string,
    callback: (ride: Ride) => void
  ): () => void {
    const rideRef = doc(db, 'rides', rideId);
    const unsubscribe = onSnapshot(rideRef, (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() } as Ride);
      }
    });
    return unsubscribe;
  }

  static subscribeToDriverLocation(
    driverId: string,
    callback: (location: { lat: number; lng: number }) => void
  ): () => void {
    const driverRef = doc(db, 'drivers', driverId);
    const unsubscribe = onSnapshot(driverRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.currentLocation) {
          callback(data.currentLocation);
        }
      }
    });
    return unsubscribe;
  }

  static subscribeToAvailableRides(
    driverId: string,
    callback: (rides: Ride[]) => void
  ): () => void {
    
    const ridesQuery = query(
      collection(db, 'rides'),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(ridesQuery, (snapshot) => {
      const rides = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ride[];
      callback(rides);
    });

    return unsubscribe;
  }

  static async cancelRide(rideId: string): Promise<void> {
    try {
      const ride = await DatabaseService.get('rides', rideId) as any;
      if (!ride) {
        throw new Error('Ride not found');
      }

      await DatabaseService.update('rides', rideId, {
        status: 'cancelled'
      });

      if (ride.driverId) {
        await DatabaseService.update('drivers', ride.driverId, {
          status: 'available'
        });
      }
    } catch (error) {
      console.error('Error cancelling ride:', error);
      throw error;
    }
  }

  static async completeRide(rideId: string): Promise<void> {
    try {
      const ride = await DatabaseService.get('rides', rideId) as any;
      if (!ride) {
        throw new Error('Ride not found');
      }

      await DatabaseService.update('rides', rideId, {
        status: 'completed'
      });

      if (ride.driverId) {
        await DatabaseService.update('drivers', ride.driverId, {
          status: 'available'
        });
      }
    } catch (error) {
      console.error('Error completing ride:', error);
      throw error;
    }
  }
}
