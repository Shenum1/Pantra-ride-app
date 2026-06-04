import { DatabaseService, Ride } from './database-service';
import { supabase } from './supabase';

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
  static async getUserRides(userId: string, filters?: RideHistoryFilters, limitCount = 50): Promise<Ride[]> {
    try {
      const conditions: any[] = [{ field: 'userId', operator: '==', value: userId }];
      if (filters?.status) conditions.push({ field: 'status', operator: '==', value: filters.status });

      let rides = (await DatabaseService.query('rides', conditions, 'createdAt', 'desc', limitCount)) as Ride[];
      rides = applyClientFilters(rides, filters);
      return rides;
    } catch {
      return [];
    }
  }

  static async getDriverRides(driverId: string, filters?: RideHistoryFilters, limitCount = 50): Promise<Ride[]> {
    try {
      const conditions: any[] = [{ field: 'driverId', operator: '==', value: driverId }];
      if (filters?.status) conditions.push({ field: 'status', operator: '==', value: filters.status });

      let rides = (await DatabaseService.query('rides', conditions, 'createdAt', 'desc', limitCount)) as Ride[];
      rides = applyClientFilters(rides, filters);
      return rides;
    } catch {
      return [];
    }
  }

  static async getUserStats(userId: string): Promise<RideStats> {
    return computeStats(await this.getUserRides(userId, undefined, 1000));
  }

  static async getDriverStats(driverId: string): Promise<RideStats> {
    return computeStats(await this.getDriverRides(driverId, undefined, 1000));
  }

  static subscribeToUserRides(userId: string, callback: (rides: Ride[]) => void): () => void {
    const channel = supabase
      .channel(`user-rides-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides', filter: `userId=eq.${userId}` },
        async () => callback(await this.getUserRides(userId))
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  static subscribeToDriverRides(driverId: string, callback: (rides: Ride[]) => void): () => void {
    const channel = supabase
      .channel(`driver-rides-${driverId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides', filter: `driverId=eq.${driverId}` },
        async () => callback(await this.getDriverRides(driverId))
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  static async exportRideHistory(userId: string, format: 'json' | 'csv'): Promise<string> {
    const rides = await this.getUserRides(userId, undefined, 1000);

    if (format === 'json') return JSON.stringify(rides, null, 2);

    const headers = ['Date', 'Pickup', 'Dropoff', 'Distance', 'Duration', 'Fare', 'Status'];
    const rows = rides.map((ride) => [
      ride.createdAt ? new Date(ride.createdAt).toISOString() : '',
      ride.pickupLocation ? `${ride.pickupLocation.lat},${ride.pickupLocation.lng}` : '',
      ride.dropoffLocation ? `${ride.dropoffLocation.lat},${ride.dropoffLocation.lng}` : '',
      ride.distance.toString(),
      ride.duration.toString(),
      ride.fare.toString(),
      ride.status,
    ]);
    return [headers, ...rows].map((r) => r.join(',')).join('\n');
  }
}

function applyClientFilters(rides: Ride[], filters?: RideHistoryFilters): Ride[] {
  if (!filters) return rides;
  return rides.filter((ride) => {
    if (filters.startDate && ride.createdAt && new Date(ride.createdAt) < filters.startDate) return false;
    if (filters.endDate && ride.createdAt && new Date(ride.createdAt) > filters.endDate) return false;
    if (filters.minFare !== undefined && ride.fare < filters.minFare) return false;
    if (filters.maxFare !== undefined && ride.fare > filters.maxFare) return false;
    return true;
  });
}

function computeStats(rides: Ride[]): RideStats {
  const completed = rides.filter((r) => r.status === 'completed');
  const cancelled = rides.filter((r) => r.status === 'cancelled');
  const totalSpent = completed.reduce((s, r) => s + r.fare, 0);
  return {
    totalRides: rides.length,
    completedRides: completed.length,
    cancelledRides: cancelled.length,
    totalSpent,
    averageFare: completed.length > 0 ? totalSpent / completed.length : 0,
    totalDistance: completed.reduce((s, r) => s + r.distance, 0),
    totalDuration: completed.reduce((s, r) => s + r.duration, 0),
  };
}
