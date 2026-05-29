import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Driver, DriverProfile, RideRequestForDriver, DriverEarnings, DriverStats } from '@/types';

export class FirebaseDriverService {
  private static getCoordinate(location: any, key: 'latitude' | 'longitude'): number {
    const shortKey = key === 'latitude' ? 'lat' : 'lng';
    const value = location?.[key] ?? location?.[shortKey];
    return typeof value === 'number' ? value : 0;
  }

  static async createDriver(userId: string, driverData: Partial<DriverProfile>): Promise<string> {
    try {
      const driverRef = doc(db, 'drivers', userId);
      const driverProfile: Partial<DriverProfile> = {
        ...driverData,
        id: userId,
        rating: 5.0,
        totalRides: 0,
        isOnline: false,
        isVerified: false,
        earnings: {
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
          total: 0,
        },
        createdAt: new Date(),
        lastActiveAt: new Date(),
      };

      await setDoc(driverRef, {
        ...driverProfile,
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      });

      return userId;
    } catch (error) {
      console.error('Error creating driver:', error);
      throw error;
    }
  }

  static async getDriver(driverId: string): Promise<DriverProfile | null> {
    try {
      const driverRef = doc(db, 'drivers', driverId);
      const driverSnap = await getDoc(driverRef);

      if (driverSnap.exists()) {
        const data = driverSnap.data();
        return {
          id: driverSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          lastActiveAt: data.lastActiveAt?.toDate?.() || new Date(),
        } as DriverProfile;
      }

      return null;
    } catch (error) {
      console.error('Error getting driver:', error);
      return null;
    }
  }

  static async updateDriver(driverId: string, updates: Partial<DriverProfile>): Promise<void> {
    try {
      const driverRef = doc(db, 'drivers', driverId);
      await updateDoc(driverRef, {
        ...updates,
        lastActiveAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating driver:', error);
      throw error;
    }
  }

  static async updateDriverLocation(
    driverId: string,
    latitude: number,
    longitude: number
  ): Promise<void> {
    try {
      const driverRef = doc(db, 'drivers', driverId);
      await updateDoc(driverRef, {
        location: { latitude, longitude },
        lastActiveAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating driver location:', error);
      throw error;
    }
  }

  static async setDriverOnlineStatus(driverId: string, isOnline: boolean): Promise<void> {
    try {
      const driverRef = doc(db, 'drivers', driverId);
      await updateDoc(driverRef, {
        isOnline,
        lastActiveAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error setting driver online status:', error);
      throw error;
    }
  }

  static async getNearbyDrivers(
    latitude: number,
    longitude: number,
    radiusKm: number = 10,
    _rideType: string = 'standard'
  ): Promise<Driver[]> {
    try {
      const driversQuery = query(
        collection(db, 'drivers'),
        where('isOnline', '==', true),
        where('isVerified', '==', true)
      );

      const snapshot = await getDocs(driversQuery);
      const drivers: Driver[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.location) {
          const distance = this.calculateDistance(
            latitude,
            longitude,
            data.location.latitude,
            data.location.longitude
          );

          if (distance <= radiusKm) {
            drivers.push({
              id: doc.id,
              name: data.name || '',
              rating: data.rating || 5.0,
              location: {
                latitude: data.location.latitude,
                longitude: data.location.longitude,
              },
              carType: data.vehicle?.type || 'Standard',
              carModel: `${data.vehicle?.make || ''} ${data.vehicle?.model || ''}`,
              licensePlate: data.vehicle?.licensePlate || '',
              eta: Math.ceil((distance / 30) * 60),
              phone: data.phone || '',
            });
          }
        }
      });

      return drivers.sort((a, b) => a.eta - b.eta);
    } catch (error) {
      console.error('Error getting nearby drivers:', error);
      return [];
    }
  }

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

  static async getPendingRideRequests(driverId: string): Promise<RideRequestForDriver[]> {
    try {
      const driver = await this.getDriver(driverId);
      if (!driver || !driver.location) {
        return [];
      }

      const ridesQuery = query(
        collection(db, 'rides'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      const snapshot = await getDocs(ridesQuery);
      const requests: RideRequestForDriver[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

        if (!data.pickupLocation || !data.dropoffLocation) continue;

        const pickupLatitude = this.getCoordinate(data.pickupLocation, 'latitude');
        const pickupLongitude = this.getCoordinate(data.pickupLocation, 'longitude');
        const dropoffLatitude = this.getCoordinate(data.dropoffLocation, 'latitude');
        const dropoffLongitude = this.getCoordinate(data.dropoffLocation, 'longitude');

        const distanceToPickup = this.calculateDistance(
          driver.location.latitude,
          driver.location.longitude,
          pickupLatitude,
          pickupLongitude
        );

        if (distanceToPickup <= 10) {
          const passengerSnap = await getDoc(doc(db, 'users', data.userId));
          const passengerData = passengerSnap.exists() ? passengerSnap.data() : {};

          requests.push({
            id: docSnap.id,
            pickupLocation: {
              latitude: pickupLatitude,
              longitude: pickupLongitude,
            },
            dropoffLocation: {
              latitude: dropoffLatitude,
              longitude: dropoffLongitude,
            },
            pickupAddress: data.pickupAddress || data.pickupLocation.address || '',
            dropoffAddress: data.dropoffAddress || data.dropoffLocation.address || '',
            rideType: data.rideType || 'standard',
            price: data.fare || 0,
            distance: data.distance || 0,
            duration: data.duration || 0,
            status: 'pending',
            passenger: {
              id: data.userId,
              name: passengerData.name || 'Passenger',
              rating: passengerData.rating || 5.0,
              photo: passengerData.photo,
              phone: passengerData.phone || '',
            },
            estimatedEarnings: (data.fare || 0) * 0.8,
            distanceToPickup,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          });
        }
      }

      return requests.sort((a, b) => a.distanceToPickup - b.distanceToPickup);
    } catch (error) {
      console.error('Error getting pending ride requests:', error);
      return [];
    }
  }

  static subscribeToRideRequests(
    driverId: string,
    callback: (requests: RideRequestForDriver[]) => void
  ): () => void {
    const ridesQuery = query(
      collection(db, 'rides'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    return onSnapshot(ridesQuery, async (snapshot) => {
      const driver = await this.getDriver(driverId);
      if (!driver || !driver.location) {
        callback([]);
        return;
      }

      const requests: RideRequestForDriver[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

        if (!data.pickupLocation || !data.dropoffLocation) continue;

        const pickupLatitude = this.getCoordinate(data.pickupLocation, 'latitude');
        const pickupLongitude = this.getCoordinate(data.pickupLocation, 'longitude');
        const dropoffLatitude = this.getCoordinate(data.dropoffLocation, 'latitude');
        const dropoffLongitude = this.getCoordinate(data.dropoffLocation, 'longitude');

        const distanceToPickup = this.calculateDistance(
          driver.location.latitude,
          driver.location.longitude,
          pickupLatitude,
          pickupLongitude
        );

        if (distanceToPickup <= 10) {
          const passengerSnap = await getDoc(doc(db, 'users', data.userId));
          const passengerData = passengerSnap.exists() ? passengerSnap.data() : {};

          requests.push({
            id: docSnap.id,
            pickupLocation: {
              latitude: pickupLatitude,
              longitude: pickupLongitude,
            },
            dropoffLocation: {
              latitude: dropoffLatitude,
              longitude: dropoffLongitude,
            },
            pickupAddress: data.pickupAddress || data.pickupLocation.address || '',
            dropoffAddress: data.dropoffAddress || data.dropoffLocation.address || '',
            rideType: data.rideType || 'standard',
            price: data.fare || 0,
            distance: data.distance || 0,
            duration: data.duration || 0,
            status: 'pending',
            passenger: {
              id: data.userId,
              name: passengerData.name || 'Passenger',
              rating: passengerData.rating || 5.0,
              photo: passengerData.photo,
              phone: passengerData.phone || '',
            },
            estimatedEarnings: (data.fare || 0) * 0.8,
            distanceToPickup,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          });
        }
      }

      callback(requests.sort((a, b) => a.distanceToPickup - b.distanceToPickup));
    });
  }

  static async acceptRide(rideId: string, driverId: string): Promise<void> {
    try {
      const rideRef = doc(db, 'rides', rideId);
      await updateDoc(rideRef, {
        driverId,
        status: 'accepted',
        acceptedAt: serverTimestamp(),
      });

      await this.updateDriver(driverId, { isOnline: false } as any);
    } catch (error) {
      console.error('Error accepting ride:', error);
      throw error;
    }
  }

  static async declineRide(rideId: string): Promise<void> {
    try {
      console.log('Ride declined:', rideId);
    } catch (error) {
      console.error('Error declining ride:', error);
      throw error;
    }
  }

  static async updateRideStatus(
    rideId: string,
    status: 'in_progress' | 'completed' | 'cancelled',
    driverId?: string
  ): Promise<void> {
    try {
      const rideRef = doc(db, 'rides', rideId);
      const updates: any = {
        status: status === 'in_progress' ? 'in-progress' : status,
      };

      if (status === 'in_progress') {
        updates.startedAt = serverTimestamp();
      } else if (status === 'completed') {
        updates.completedAt = serverTimestamp();
      } else if (status === 'cancelled') {
        updates.cancelledAt = serverTimestamp();
      }

      await updateDoc(rideRef, updates);

      if ((status === 'completed' || status === 'cancelled') && driverId) {
        await this.updateDriver(driverId, { isOnline: true } as any);
      }
    } catch (error) {
      console.error('Error updating ride status:', error);
      throw error;
    }
  }

  static async getDriverEarnings(
    driverId: string,
    limitCount: number = 50
  ): Promise<DriverEarnings[]> {
    try {
      const ridesQuery = query(
        collection(db, 'rides'),
        where('driverId', '==', driverId),
        where('status', '==', 'completed'),
        orderBy('completedAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(ridesQuery);
      const earnings: DriverEarnings[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const amount = data.fare || 0;
        const commission = amount * 0.2;
        const netAmount = amount - commission;

        earnings.push({
          id: docSnap.id,
          driverId,
          rideId: docSnap.id,
          amount,
          commission,
          netAmount,
          payoutStatus: 'completed',
          payoutDate: data.completedAt?.toDate?.(),
          createdAt: data.createdAt?.toDate?.() || new Date(),
        });
      });

      return earnings;
    } catch (error) {
      console.error('Error getting driver earnings:', error);
      return [];
    }
  }

  static async getDriverStats(driverId: string): Promise<DriverStats> {
    try {
      const ridesQuery = query(
        collection(db, 'rides'),
        where('driverId', '==', driverId),
        where('status', '==', 'completed')
      );

      const snapshot = await getDocs(ridesQuery);
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      let totalRides = 0;
      let totalEarnings = 0;
      let totalRating = 0;
      let todayEarnings = 0;
      let weekEarnings = 0;
      let monthEarnings = 0;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const amount = (data.fare || 0) * 0.8;
        const completedAt = data.completedAt?.toDate?.();
        const rating = data.driverRating || 0;

        totalRides++;
        totalEarnings += amount;
        if (rating > 0) totalRating += rating;

        if (completedAt) {
          if (completedAt >= today) todayEarnings += amount;
          if (completedAt >= weekStart) weekEarnings += amount;
          if (completedAt >= monthStart) monthEarnings += amount;
        }
      });

      const averageRating = totalRides > 0 ? totalRating / totalRides : 5.0;

      return {
        totalRides,
        totalEarnings,
        averageRating,
        acceptanceRate: 92,
        cancellationRate: 3,
        onlineHours: 156,
        completionRate: 97,
        todayEarnings,
        weekEarnings,
        monthEarnings,
      };
    } catch (error) {
      console.error('Error getting driver stats:', error);
      return {
        totalRides: 0,
        totalEarnings: 0,
        averageRating: 5.0,
        acceptanceRate: 0,
        cancellationRate: 0,
        onlineHours: 0,
        completionRate: 0,
        todayEarnings: 0,
        weekEarnings: 0,
        monthEarnings: 0,
      };
    }
  }

  static subscribeToDriverProfile(
    driverId: string,
    callback: (profile: DriverProfile | null) => void
  ): () => void {
    const driverRef = doc(db, 'drivers', driverId);

    return onSnapshot(driverRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        callback({
          id: snapshot.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          lastActiveAt: data.lastActiveAt?.toDate?.() || new Date(),
        } as DriverProfile);
      } else {
        callback(null);
      }
    });
  }
}
