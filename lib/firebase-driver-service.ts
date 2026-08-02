import { supabase } from './supabase';
import { Driver, DriverProfile, RideRequestForDriver, DriverEarnings, DriverStats } from '@/types';
import { calculateDriverPayout, calculateWaitingCharge } from './fare-calculator';

export interface DriverTripRecord {
  id: string;
  pickupAddress: string;
  dropoffAddress: string;
  distance: number;
  duration: number;
  fare: number;
  rating: number | null;
  status: 'completed' | 'cancelled';
  completedAt: Date | null;
}

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
      rating: null,
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

  // Tracks a continuous online shift for DriverStats.onlineHours. Deliberately
  // separate from setDriverOnlineStatus, which also flips isOnline off/on while
  // a driver is mid-ride (busy vs available for new pickups) — using that signal
  // here would fragment one shift into a new session every time a ride is
  // accepted/completed. Only call these from an explicit driver-initiated
  // online/offline toggle.
  static async startOnlineSession(driverId: string): Promise<void> {
    const { data: openSession } = await supabase
      .from('driver_online_sessions')
      .select('id')
      .eq('driverId', driverId)
      .is('endedAt', null)
      .maybeSingle();
    if (!openSession) {
      const { error } = await supabase.from('driver_online_sessions').insert({ driverId });
      if (error) throw new Error(error.message);
    }
  }

  static async endOnlineSession(driverId: string): Promise<void> {
    const { error } = await supabase
      .from('driver_online_sessions')
      .update({ endedAt: new Date().toISOString() })
      .eq('driverId', driverId)
      .is('endedAt', null);
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
          rating: d.rating ?? null,
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

  private static async getDeclinedRideIds(driverId: string): Promise<Set<string>> {
    const { data, error } = await supabase
      .from('ride_declines')
      .select('rideId')
      .eq('driverId', driverId);

    if (error) {
      console.error('getDeclinedRideIds failed:', error.message);
      return new Set();
    }
    return new Set((data ?? []).map((d: { rideId: string }) => d.rideId));
  }

  static async getPendingRideRequests(driverId: string): Promise<RideRequestForDriver[]> {
    const driver = await this.getDriver(driverId);
    if (!driver?.location) return [];

    const { data: rides, error } = await supabase
      .from('rides')
      .select('*')
      .eq('status', 'pending')
      .order('createdAt', { ascending: false })
      .limit(20);

    if (error) console.error('getPendingRideRequests failed:', error.message);
    if (error || !rides) return [];

    const declinedIds = await this.getDeclinedRideIds(driverId);
    const visibleRides = rides.filter((r: { id: string }) => !declinedIds.has(r.id));
    return this.mapRidesToRequests(visibleRides, driver);
  }

  static subscribeToRideRequests(
    driverId: string,
    callback: (requests: RideRequestForDriver[]) => void
  ): () => void {
    const channel = supabase
      .channel(`pending-rides-${driverId}`)
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

          const declinedIds = await this.getDeclinedRideIds(driverId);
          const visibleRides = (rides ?? []).filter((r: { id: string }) => !declinedIds.has(r.id));
          callback(this.mapRidesToRequests(visibleRides, driver));
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

      const passenger = ride.users || {};
      results.push({
        id: ride.id,
        pickupLocation: { latitude: pickupLat, longitude: pickupLng },
        dropoffLocation: { latitude: dropoffLat, longitude: dropoffLng },
        pickupAddress: ride.pickupAddress || '',
        dropoffAddress: ride.dropoffAddress || '',
        rideType: ride.rideType || 'standard',
        price: ride.fare || 0,
        offeredFare: ride.offeredFare ?? undefined,
        negotiationStatus: ride.negotiationStatus ?? undefined,
        distance: ride.distance || 0,
        duration: ride.duration || 0,
        status: 'pending',
        passenger: {
          id: ride.userId,
          name: passenger.displayName || 'Passenger',
          rating: passenger.rating ?? null,
          photo: passenger.photoURL,
          phone: passenger.phone || '',
        },
        estimatedEarnings: calculateDriverPayout(ride.fare || 0, ride.bookingFee || 0, ride.serviceFee || 0, ride.zoneFee || 0, ride.waitingCharge || 0).netAmount,
        distanceToPickup,
        createdAt: ride.createdAt ? new Date(ride.createdAt) : new Date(),
      });
    }

    return results.sort((a, b) => a.distanceToPickup - b.distanceToPickup);
  }

  static async acceptRide(rideId: string, driverId: string, acceptedOfferedFare?: number): Promise<void> {
    const updates: any = { driverId, status: 'accepted', acceptedAt: new Date().toISOString() };

    // Accepting a negotiated ride locks in the rider's proposed price as the
    // real fare from this point on — everything downstream (payout, admin
    // breakdown, ride history) treats it identically to a normal metered ride.
    if (acceptedOfferedFare !== undefined) {
      updates.fare = acceptedOfferedFare;
      updates.negotiationStatus = 'accepted';
    }

    const { error } = await supabase
      .from('rides')
      .update(updates)
      .eq('id', rideId);
    if (error) throw new Error(error.message);
    await this.setDriverOnlineStatus(driverId, false);
  }

  static async declineRide(rideId: string, driverId: string): Promise<void> {
    const { error } = await supabase
      .from('ride_declines')
      .upsert({ rideId, driverId }, { onConflict: 'rideId,driverId', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  static async updateRideStatus(
    rideId: string,
    status: 'in_progress' | 'completed' | 'cancelled',
    driverId?: string
  ): Promise<void> {
    const updates: any = { status: status === 'in_progress' ? 'in-progress' : status };

    if (status === 'in_progress') {
      const startedAt = new Date();
      updates.startedAt = startedAt.toISOString();

      // Waiting charge can't be known upfront at booking time — compute it
      // now, from arrivedAt (set when the driver reached pickup) to now.
      const { data: rideRow } = await supabase
        .from('rides')
        .select('arrivedAt, fare')
        .eq('id', rideId)
        .single();

      if (rideRow?.arrivedAt) {
        const waitingCharge = calculateWaitingCharge(new Date(rideRow.arrivedAt), startedAt);
        if (waitingCharge > 0) {
          updates.waitingCharge = waitingCharge;
          updates.fare = (rideRow.fare || 0) + waitingCharge;
        }
      }
    } else if (status === 'completed') {
      updates.completedAt = new Date().toISOString();
    } else if (status === 'cancelled') {
      updates.cancelledAt = new Date().toISOString();
    }

    const { error } = await supabase.from('rides').update(updates).eq('id', rideId);
    if (error) throw new Error(error.message);

    if ((status === 'completed' || status === 'cancelled') && driverId) {
      await this.setDriverOnlineStatus(driverId, true);
    }
  }

  static async getDriverTripHistory(driverId: string, limitCount = 100): Promise<DriverTripRecord[]> {
    const { data, error } = await supabase
      .from('rides')
      .select('id, pickupAddress, dropoffAddress, distance, duration, fare, driverRating, status, completedAt, cancelledAt')
      .eq('driverId', driverId)
      .in('status', ['completed', 'cancelled'])
      .order('createdAt', { ascending: false })
      .limit(limitCount);

    if (error || !data) return [];

    return data.map((ride: any) => ({
      id: ride.id,
      pickupAddress: ride.pickupAddress || '',
      dropoffAddress: ride.dropoffAddress || '',
      distance: ride.distance || 0,
      duration: ride.duration || 0,
      fare: ride.fare || 0,
      rating: ride.driverRating ?? null,
      status: ride.status === 'cancelled' ? 'cancelled' : 'completed',
      completedAt: ride.completedAt
        ? new Date(ride.completedAt)
        : ride.cancelledAt
          ? new Date(ride.cancelledAt)
          : null,
    }));
  }

  static async getDriverEarnings(driverId: string, limitCount = 50): Promise<DriverEarnings[]> {
    const { data, error } = await supabase
      .from('rides')
      .select('id, fare, bookingFee, serviceFee, zoneFee, waitingCharge, cancellationFee, status, completedAt, cancelledAt, createdAt')
      .eq('driverId', driverId)
      .in('status', ['completed', 'cancelled'])
      .order('createdAt', { ascending: false })
      .limit(limitCount);

    if (error || !data) return [];

    return data
      // A cancelled ride only counts as a payout if it actually charged a
      // cancellation fee — free cancellations aren't a driver earning.
      .filter((ride: any) => ride.status === 'completed' || (ride.cancellationFee || 0) > 0)
      .map((ride: any) => {
        const isCancelled = ride.status === 'cancelled';
        const amount = isCancelled ? (ride.cancellationFee || 0) : (ride.fare || 0);
        const { commission, netAmount } = isCancelled
          ? calculateDriverPayout(amount)
          : calculateDriverPayout(amount, ride.bookingFee || 0, ride.serviceFee || 0, ride.zoneFee || 0, ride.waitingCharge || 0);
        return {
          id: ride.id,
          driverId,
          rideId: ride.id,
          amount,
          commission,
          netAmount,
          payoutStatus: 'completed',
          payoutDate: isCancelled
            ? (ride.cancelledAt ? new Date(ride.cancelledAt) : undefined)
            : (ride.completedAt ? new Date(ride.completedAt) : undefined),
          createdAt: new Date(ride.createdAt),
        };
      });
  }

  static async getDriverStats(driverId: string): Promise<DriverStats> {
    const [ridesResult, assignedResult, declinedResult, sessionsResult] = await Promise.all([
      supabase
        .from('rides')
        .select('fare, bookingFee, serviceFee, zoneFee, waitingCharge, cancellationFee, completedAt, cancelledAt, driverRating, status')
        .eq('driverId', driverId)
        .in('status', ['completed', 'cancelled']),
      supabase
        .from('rides')
        .select('id', { count: 'exact', head: true })
        .eq('driverId', driverId),
      supabase
        .from('ride_declines')
        .select('id', { count: 'exact', head: true })
        .eq('driverId', driverId),
      supabase
        .from('driver_online_sessions')
        .select('startedAt, endedAt')
        .eq('driverId', driverId),
    ]);

    if (ridesResult.error || !ridesResult.data) return defaultStats();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let completedCount = 0, cancelledCount = 0, totalEarnings = 0, totalRating = 0, ratedRides = 0;
    let todayEarnings = 0, weekEarnings = 0, monthEarnings = 0;

    for (const ride of ridesResult.data) {
      if (ride.status === 'cancelled') {
        cancelledCount++;
        // A cancellation fee (if any) still pays the driver via the normal
        // 80/20 split — it just isn't a "completed ride" for the trip count.
        const cancellationFee = (ride as any).cancellationFee || 0;
        if (cancellationFee > 0) {
          const amount = calculateDriverPayout(cancellationFee).netAmount;
          const cancelledAt = (ride as any).cancelledAt ? new Date((ride as any).cancelledAt) : null;
          totalEarnings += amount;
          if (cancelledAt) {
            if (cancelledAt >= today) todayEarnings += amount;
            if (cancelledAt >= weekStart) weekEarnings += amount;
            if (cancelledAt >= monthStart) monthEarnings += amount;
          }
        }
        continue;
      }
      completedCount++;
      const amount = calculateDriverPayout(ride.fare || 0, ride.bookingFee || 0, ride.serviceFee || 0, ride.zoneFee || 0, ride.waitingCharge || 0).netAmount;
      const completedAt = ride.completedAt ? new Date(ride.completedAt) : null;
      const rating = ride.driverRating || 0;

      totalEarnings += amount;
      if (rating > 0) {
        totalRating += rating;
        ratedRides++;
      }

      if (completedAt) {
        if (completedAt >= today) todayEarnings += amount;
        if (completedAt >= weekStart) weekEarnings += amount;
        if (completedAt >= monthStart) monthEarnings += amount;
      }
    }

    // Pull-model marketplace has no per-driver "offer" event to measure acceptance
    // against, so this approximates it from the two events that ARE recorded:
    // rides this driver ended up assigned to vs. rides they explicitly declined.
    const assignedCount = assignedResult.count ?? 0;
    const declinedCount = declinedResult.count ?? 0;
    const respondedCount = assignedCount + declinedCount;
    const settledCount = completedCount + cancelledCount;

    // Cap any single session at 12h so a crashed app that never closed its
    // session (no endedAt) doesn't inflate this indefinitely.
    const MAX_SESSION_HOURS = 12;
    let onlineHours = 0;
    if (!sessionsResult.error && sessionsResult.data) {
      for (const session of sessionsResult.data as { startedAt: string; endedAt: string | null }[]) {
        const start = new Date(session.startedAt).getTime();
        const end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
        const hours = Math.min((end - start) / (1000 * 60 * 60), MAX_SESSION_HOURS);
        if (hours > 0) onlineHours += hours;
      }
    }

    return {
      totalRides: completedCount,
      totalEarnings,
      averageRating: ratedRides > 0 ? totalRating / ratedRides : null,
      acceptanceRate: respondedCount > 0 ? Math.round((assignedCount / respondedCount) * 100) : 0,
      cancellationRate: settledCount > 0 ? Math.round((cancelledCount / settledCount) * 100) : 0,
      onlineHours,
      completionRate: settledCount > 0 ? Math.round((completedCount / settledCount) * 100) : 0,
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
    totalRides: 0, totalEarnings: 0, averageRating: null,
    acceptanceRate: 0, cancellationRate: 0, onlineHours: 0,
    completionRate: 0, todayEarnings: 0, weekEarnings: 0, monthEarnings: 0,
  };
}
