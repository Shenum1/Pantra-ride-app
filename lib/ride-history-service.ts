import { DatabaseService, Ride } from './database-service';
import { onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';

export interface RideHistoryFilters {
  status?: 'pending' | 'accepted' | 'in-progress' | 'completed' | 'cancelled';
  startDate?: Date;
  endDate?: Date;
  minFare?: number;
  maxFare?: number;
}

export interface RideStats {
  totalRides: number;
  completedRides: number;
  cancelledRides: number;
  totalSpent: number;
  averageFare: number;
  totalDistance: number;
  totalDuration: number;
}

export class RideHistoryService {
  static async getUserRides(
    userId: string,
    filters?: RideHistoryFilters,
    limitCount: number = 50
  ): Promise<Ride[]> {
    try {
      const conditions = [{ field: 'userId', operator: '==', value: userId }];

      if (filters?.status) {
        conditions.push({ field: 'status', operator: '==', value: filters.status });
      }

      const rides = await DatabaseService.query(
        'rides',
        conditions as any,
        'createdAt',
        'desc',
        limitCount
      );

      let filteredRides = rides as Ride[];

      if (filters?.startDate) {
        filteredRides = filteredRides.filter(
          (ride) => ride.createdAt && new Date(ride.createdAt as any) >= filters.startDate!
        );
      }

      if (filters?.endDate) {
        filteredRides = filteredRides.filter(
          (ride) => ride.createdAt && new Date(ride.createdAt as any) <= filters.endDate!
        );
      }

      if (filters?.minFare !== undefined) {
        filteredRides = filteredRides.filter((ride) => ride.fare >= filters.minFare!);
      }

      if (filters?.maxFare !== undefined) {
        filteredRides = filteredRides.filter((ride) => ride.fare <= filters.maxFare!);
      }

      return filteredRides;
    } catch (error) {
      console.error('Error getting user rides:', error);
      return [];
    }
  }

  static async getDriverRides(
    driverId: string,
    filters?: RideHistoryFilters,
    limitCount: number = 50
  ): Promise<Ride[]> {
    try {
      const conditions = [{ field: 'driverId', operator: '==', value: driverId }];

      if (filters?.status) {
        conditions.push({ field: 'status', operator: '==', value: filters.status });
      }

      const rides = await DatabaseService.query(
        'rides',
        conditions as any,
        'createdAt',
        'desc',
        limitCount
      );

      let filteredRides = rides as Ride[];

      if (filters?.startDate) {
        filteredRides = filteredRides.filter(
          (ride) => ride.createdAt && new Date(ride.createdAt as any) >= filters.startDate!
        );
      }

      if (filters?.endDate) {
        filteredRides = filteredRides.filter(
          (ride) => ride.createdAt && new Date(ride.createdAt as any) <= filters.endDate!
        );
      }

      if (filters?.minFare !== undefined) {
        filteredRides = filteredRides.filter((ride) => ride.fare >= filters.minFare!);
      }

      if (filters?.maxFare !== undefined) {
        filteredRides = filteredRides.filter((ride) => ride.fare <= filters.maxFare!);
      }

      return filteredRides;
    } catch (error) {
      console.error('Error getting driver rides:', error);
      return [];
    }
  }

  static async getUserStats(userId: string): Promise<RideStats> {
    try {
      const rides = await this.getUserRides(userId, undefined, 1000);

      const completedRides = rides.filter((r) => r.status === 'completed');
      const cancelledRides = rides.filter((r) => r.status === 'cancelled');

      const totalSpent = completedRides.reduce((sum, ride) => sum + ride.fare, 0);
      const totalDistance = completedRides.reduce((sum, ride) => sum + ride.distance, 0);
      const totalDuration = completedRides.reduce((sum, ride) => sum + ride.duration, 0);

      return {
        totalRides: rides.length,
        completedRides: completedRides.length,
        cancelledRides: cancelledRides.length,
        totalSpent,
        averageFare: completedRides.length > 0 ? totalSpent / completedRides.length : 0,
        totalDistance,
        totalDuration,
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {
        totalRides: 0,
        completedRides: 0,
        cancelledRides: 0,
        totalSpent: 0,
        averageFare: 0,
        totalDistance: 0,
        totalDuration: 0,
      };
    }
  }

  static async getDriverStats(driverId: string): Promise<RideStats> {
    try {
      const rides = await this.getDriverRides(driverId, undefined, 1000);

      const completedRides = rides.filter((r) => r.status === 'completed');
      const cancelledRides = rides.filter((r) => r.status === 'cancelled');

      const totalEarned = completedRides.reduce((sum, ride) => sum + ride.fare, 0);
      const totalDistance = completedRides.reduce((sum, ride) => sum + ride.distance, 0);
      const totalDuration = completedRides.reduce((sum, ride) => sum + ride.duration, 0);

      return {
        totalRides: rides.length,
        completedRides: completedRides.length,
        cancelledRides: cancelledRides.length,
        totalSpent: totalEarned,
        averageFare: completedRides.length > 0 ? totalEarned / completedRides.length : 0,
        totalDistance,
        totalDuration,
      };
    } catch (error) {
      console.error('Error getting driver stats:', error);
      return {
        totalRides: 0,
        completedRides: 0,
        cancelledRides: 0,
        totalSpent: 0,
        averageFare: 0,
        totalDistance: 0,
        totalDuration: 0,
      };
    }
  }

  static subscribeToUserRides(
    userId: string,
    callback: (rides: Ride[]) => void
  ): () => void {
    const ridesQuery = query(
      collection(db, 'rides'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(ridesQuery, (snapshot) => {
      const rides = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Ride[];
      callback(rides);
    });

    return unsubscribe;
  }

  static subscribeToDriverRides(
    driverId: string,
    callback: (rides: Ride[]) => void
  ): () => void {
    const ridesQuery = query(
      collection(db, 'rides'),
      where('driverId', '==', driverId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(ridesQuery, (snapshot) => {
      const rides = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Ride[];
      callback(rides);
    });

    return unsubscribe;
  }

  static async exportRideHistory(userId: string, format: 'json' | 'csv'): Promise<string> {
    try {
      const rides = await this.getUserRides(userId, undefined, 1000);

      if (format === 'json') {
        return JSON.stringify(rides, null, 2);
      } else {
        const headers = [
          'Date',
          'Pickup',
          'Dropoff',
          'Distance',
          'Duration',
          'Fare',
          'Status',
        ];
        const rows = rides.map((ride) => [
          ride.createdAt ? new Date(ride.createdAt as any).toISOString() : '',
          ride.pickupLocation ? `${ride.pickupLocation.lat},${ride.pickupLocation.lng}` : '',
          ride.dropoffLocation ? `${ride.dropoffLocation.lat},${ride.dropoffLocation.lng}` : '',
          ride.distance.toString(),
          ride.duration.toString(),
          ride.fare.toString(),
          ride.status,
        ]);

        const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
        return csv;
      }
    } catch (error) {
      console.error('Error exporting ride history:', error);
      throw error;
    }
  }
}
