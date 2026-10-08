import { supabase } from './supabase';
import { Driver, DriverProfile, PassengerInfo, RideRequestForDriver, DriverEarnings, DriverStats } from '@/types';
import { calculateDriverPayout, calculateWaitingCharge } from './fare-calculator';

// The driver owes more than the cash commission limit, so the database
// refused to let them accept a cash ride.
export class CashRidesPausedError extends Error {
  constructor() {
    super('Cash rides are paused until you pay the commission you owe. Wallet rides are still available.');
    this.name = 'CashRidesPausedError';
  }
}

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

// Public driver fields returned by the get_nearby_drivers / get_ride_driver
// RPCs (supabase-schema-security-hardening.sql). `phone` is only ever set by
// get_ride_driver, for the driver on the caller's own active ride.
interface PublicDriverRow {
  id: string;
  name: string | null;
  profileImage: string | null;
  rating: number | null;
  location: { latitude?: number; longitude?: number; lat?: number; lng?: number } | null;
  vehicle: { make?: string; model?: string; licensePlate?: string; type?: string; color?: string } | null;
  vehiclePlateNumber: string | null;
  distanceKm?: number | null;
  phone?: string | null;
}

function mapPublicDriver(d: PublicDriverRow): Omit<Driver, 'eta' | 'phone'> {
  return {
    id: d.id,
    name: d.name || '',
    rating: d.rating ?? null,
    location: d.location
      ? { latitude: coord(d.location, 'latitude'), longitude: coord(d.location, 'longitude') }
      : undefined,
    carType: d.vehicle?.type || 'Standard',
    carModel: `${d.vehicle?.make || ''} ${d.vehicle?.model || ''}`.trim(),
    licensePlate: d.vehicle?.licensePlate || d.vehiclePlateNumber || '',
  };
}

// Returned by the accept_ride / get_ride_rider_for_driver RPCs — only ever to
// the driver assigned to that ride.
interface RideRiderRow {
  rideId: string;
  userId: string | null;
  riderName: string | null;
  riderPhone: string | null;
  riderPhoto: string | null;
  riderRating: number | null;
  passengerName: string | null;
  passengerPhone: string | null;
  rideStatus: string | null;
}

export interface AcceptedRideDetails {
  passenger: PassengerInfo;
  passengerName?: string;
  passengerPhone?: string;
}

function buildAcceptedRideDetails(row: RideRiderRow | undefined): AcceptedRideDetails {
  // A ride booked for someone else carries a passengerName/passengerPhone
  // override on the ride row — that's who's physically in the car and who
  // Call/display should show. bookerName/bookerPhone (the account holder)
  // are kept separately since only the booker has an app account that
  // in-app messaging can actually reach.
  return {
    passengerName: row?.passengerName ?? undefined,
    passengerPhone: row?.passengerPhone ?? undefined,
    passenger: {
      id: row?.userId ?? '',
      name: row?.passengerName || row?.riderName || 'Passenger',
      rating: row?.riderRating ?? null,
      photo: row?.riderPhoto ?? undefined,
      phone: row?.passengerPhone || row?.riderPhone || '',
      bookerName: row?.riderName || undefined,
      bookerPhone: row?.riderPhone || undefined,
    },
  };
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

  // Riders can't read the drivers table (supabase-schema-security-hardening.sql);
  // get_nearby_drivers returns only public fields of online, VERIFIED drivers
  // within the radius — never a phone number.
  static async getNearbyDrivers(latitude: number, longitude: number, radiusKm = 10): Promise<Driver[]> {
    const { data, error } = await supabase.rpc('get_nearby_drivers', {
      p_latitude: latitude,
      p_longitude: longitude,
      p_radius_km: radiusKm,
    });

    if (error) console.error('getNearbyDrivers failed:', error.message);
    if (error || !data) return [];

    return (data as PublicDriverRow[])
      .filter((d) => !!d.location)
      .map((d) => {
        const distance = typeof d.distanceKm === 'number'
          ? d.distanceKm
          : calculateDistance(latitude, longitude, coord(d.location, 'latitude'), coord(d.location, 'longitude'));
        return {
          ...mapPublicDriver(d),
          eta: Math.ceil((distance / 30) * 60),
          phone: '',
        };
      })
      .sort((a, b) => a.eta - b.eta);
  }

  // The driver assigned to one of the signed-in rider's own rides. Phone and
  // live location come back only while that ride is accepted/in-progress.
  static async getRideDriver(rideId: string): Promise<Driver | null> {
    const { data, error } = await supabase.rpc('get_ride_driver', { p_ride_id: rideId });
    if (error) console.error('getRideDriver failed:', error.message);
    const row = (data as PublicDriverRow[] | null)?.[0];
    if (error || !row) return null;
    return { ...mapPublicDriver(row), eta: 3, phone: row.phone ?? '' };
  }

  // Live position of the driver assigned to the rider's ride. Riders can't
  // subscribe to the drivers table any more (no SELECT on it), so this polls
  // get_ride_driver — drivers send a GPS ping about every 5s.
  static subscribeToRideDriverLocation(
    rideId: string,
    callback: (location: { lat: number; lng: number }) => void,
    intervalMs = 4000
  ): () => void {
    let stopped = false;
    const poll = async () => {
      const driver = await this.getRideDriver(rideId);
      if (stopped || !driver?.location) return;
      callback({ lat: driver.location.latitude, lng: driver.location.longitude });
    };
    void poll();
    const timer = setInterval(() => { void poll(); }, intervalMs);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }

  // Pending rides come from get_pending_rides_for_driver, which only answers a
  // VERIFIED driver, already excludes rides this driver declined, and never
  // includes the passenger's/rider's name or phone (those are revealed by
  // acceptRide, to the accepting driver only).
  static async getPendingRideRequests(driverId: string): Promise<RideRequestForDriver[]> {
    const driver = await this.getDriver(driverId);
    if (!driver?.location) return [];

    const { data: rides, error } = await supabase.rpc('get_pending_rides_for_driver', { p_limit: 20 });

    if (error) console.error('getPendingRideRequests failed:', error.message);
    if (error || !rides) return [];

    return this.mapRidesToRequests(rides as any[], driver);
  }

  // Drivers can't subscribe to pending rows of `rides` any more (no SELECT on
  // them), so they listen to pending_ride_signals — a rideId-only mirror of
  // which rides are pending — and re-fetch the list through the RPC.
  static subscribeToRideRequests(
    driverId: string,
    callback: (requests: RideRequestForDriver[]) => void
  ): () => void {
    const channel = supabase
      .channel(`pending-rides-${driverId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_ride_signals' },
        async () => {
          callback(await this.getPendingRideRequests(driverId));
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

      // Who the passenger is (name/phone/photo/account id) is deliberately not
      // known yet — the database only reveals it to the driver who accepts
      // (see acceptRide / buildPassengerInfo). Only the rider's rating is shown.
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
          id: '',
          name: 'Passenger',
          rating: ride.riderRating ?? null,
        },
        estimatedEarnings: calculateDriverPayout(ride.fare || 0, ride.bookingFee || 0, ride.serviceFee || 0, ride.zoneFee || 0, ride.waitingCharge || 0, ride.priorityFee || 0).netAmount,
        // rides.create stores plain 'cash'/'wallet'; anything else (a ride
        // booked before that) is treated as cash, the safe side for hiding.
        paysWith: ride.paymentMethod === 'wallet' ? 'wallet' : 'cash',
        isPriority: !!ride.isPriority,
        distanceToPickup,
        createdAt: ride.createdAt ? new Date(ride.createdAt) : new Date(),
      });
    }

    // Priority-paid rides sort to the top of every online driver's list —
    // this is a pull-model broadcast (all online drivers see the same
    // pending ride at once), so "priority" can only bias ordering here, not
    // guarantee a faster match.
    return results.sort((a, b) => {
      if (!!a.isPriority !== !!b.isPriority) {
        return a.isPriority ? -1 : 1;
      }
      return a.distanceToPickup - b.distanceToPickup;
    });
  }

  // accept_ride atomically claims the ride for the signed-in (VERIFIED) driver
  // and is the first point the rider's/passenger's contact details are
  // revealed — to this driver only.
  static async acceptRide(rideId: string, driverId: string): Promise<AcceptedRideDetails> {
    const { data, error } = await supabase.rpc('accept_ride', { p_ride_id: rideId });
    if (error) {
      // Raised by the rides_cash_dispatch_guard database check
      // (supabase-schema-cash-commission-settlement.sql) when this driver
      // owes more than the cash commission limit.
      if (error.message?.includes('CASH_RIDES_PAUSED')) {
        throw new CashRidesPausedError();
      }
      if (error.message?.includes('RIDE_NOT_AVAILABLE')) {
        throw new Error('This ride was already taken or cancelled.');
      }
      throw new Error(error.message);
    }
    await this.setDriverOnlineStatus(driverId, false);
    return buildAcceptedRideDetails((data as RideRiderRow[] | null)?.[0]);
  }

  // Re-reads the rider/passenger details of a ride assigned to the signed-in
  // driver (phones only while the ride is active).
  static async getRideRiderDetails(rideId: string): Promise<AcceptedRideDetails | null> {
    const { data, error } = await supabase.rpc('get_ride_rider_for_driver', { p_ride_id: rideId });
    if (error) console.error('getRideRiderDetails failed:', error.message);
    const row = (data as RideRiderRow[] | null)?.[0];
    if (error || !row) return null;
    return buildAcceptedRideDetails(row);
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
        // Live-tunable from Supabase (waiting_charge_config) rather than the
        // hardcoded WAITING_CHARGE_CONFIG default — this class has no access
        // to the react-query cache useRideStore uses for the other tunable
        // configs, so it fetches directly; this fires once per ride at the
        // trip-start transition, not on a hot path.
        const { data: waitingConfigRow } = await supabase
          .from('waiting_charge_config')
          .select('graceMinutes, perMinuteRate')
          .limit(1)
          .maybeSingle();

        const waitingConfig = waitingConfigRow
          ? {
              graceMinutes: Number(waitingConfigRow.graceMinutes),
              perMinuteRate: Number(waitingConfigRow.perMinuteRate),
            }
          : undefined;

        const waitingCharge = calculateWaitingCharge(new Date(rideRow.arrivedAt), startedAt, waitingConfig);
        if (waitingCharge > 0) {
          updates.waitingCharge = waitingCharge;
          updates.fare = (rideRow.fare || 0) + waitingCharge;
        }
      }
    } else if (status === 'completed') {
      updates.completedAt = new Date().toISOString();

      // Snapshot the commission split at the moment the ride actually
      // settles, using whatever fare/fees are on the row right now (the
      // waiting charge, if any, was already folded into `fare` above when
      // the ride started). This locks in the rate that was in effect for
      // this ride — see PLATFORM_COMMISSION_RATE's doc comment.
      const { data: completingRow } = await supabase
        .from('rides')
        .select('fare, bookingFee, serviceFee, zoneFee, waitingCharge, priorityFee')
        .eq('id', rideId)
        .single();

      if (completingRow) {
        const payout = calculateDriverPayout(
          completingRow.fare || 0,
          completingRow.bookingFee || 0,
          completingRow.serviceFee || 0,
          completingRow.zoneFee || 0,
          completingRow.waitingCharge || 0,
          completingRow.priorityFee || 0
        );
        updates.platformCommissionRate = payout.commissionRate;
        updates.platformCommissionAmount = payout.commission;
        updates.driverEarningsAmount = payout.netAmount;
      }
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
      .select('id, fare, bookingFee, serviceFee, zoneFee, waitingCharge, priorityFee, cancellationFee, status, completedAt, cancelledAt, createdAt, platformCommissionAmount, driverEarningsAmount')
      .eq('driverId', driverId)
      .in('status', ['completed', 'cancelled'])
      .order('createdAt', { ascending: false })
      .limit(limitCount);

    if (error || !data) return [];

    // Tips are a separate, 100%-driver transaction — never merged into
    // amount/commission/netAmount above. Joined in here purely for display
    // (see DriverEarnings.tipAmount), one query for the whole page of rides.
    const { data: tipRows } = await supabase
      .from('tips')
      .select('rideId, amount')
      .eq('driverId', driverId)
      .eq('status', 'successful');
    const tipsByRide = new Map<string, number>();
    for (const t of (tipRows ?? []) as { rideId: string; amount: number }[]) {
      tipsByRide.set(t.rideId, (tipsByRide.get(t.rideId) ?? 0) + Number(t.amount));
    }

    return data
      // A cancelled ride only counts as a payout if it actually charged a
      // cancellation fee — free cancellations aren't a driver earning.
      .filter((ride: any) => ride.status === 'completed' || (ride.cancellationFee || 0) > 0)
      .map((ride: any) => {
        const isCancelled = ride.status === 'cancelled';
        const amount = isCancelled ? (ride.cancellationFee || 0) : (ride.fare || 0);
        // Prefer the commission snapshotted at settlement time (see
        // updateRideStatus) so a later PLATFORM_COMMISSION_RATE change never
        // rewrites a historical trip's numbers. Only legacy rows from before
        // that snapshot existed fall back to a live recalculation.
        const hasSnapshot = ride.platformCommissionAmount != null && ride.driverEarningsAmount != null;
        const payout = hasSnapshot
          ? { commission: ride.platformCommissionAmount, netAmount: ride.driverEarningsAmount }
          : isCancelled
            ? calculateDriverPayout(amount)
            : calculateDriverPayout(amount, ride.bookingFee || 0, ride.serviceFee || 0, ride.zoneFee || 0, ride.waitingCharge || 0, ride.priorityFee || 0);
        const { commission, netAmount } = payout;
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
          tipAmount: tipsByRide.get(ride.id) ?? 0,
        };
      });
  }

  static async getDriverStats(driverId: string): Promise<DriverStats> {
    const [ridesResult, assignedResult, declinedResult, sessionsResult, tipsResult] = await Promise.all([
      supabase
        .from('rides')
        .select('fare, bookingFee, serviceFee, zoneFee, waitingCharge, priorityFee, cancellationFee, completedAt, cancelledAt, driverRating, status, platformCommissionAmount, driverEarningsAmount')
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
      supabase
        .from('tips')
        .select('amount, createdAt')
        .eq('driverId', driverId)
        .eq('status', 'successful'),
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
      // Prefer the commission snapshotted at settlement time (see
      // updateRideStatus) so a later PLATFORM_COMMISSION_RATE change never
      // rewrites a historical trip's numbers. Only legacy rows from before
      // that snapshot existed fall back to a live recalculation.
      const hasSnapshot = (ride as any).platformCommissionAmount != null && (ride as any).driverEarningsAmount != null;

      if (ride.status === 'cancelled') {
        cancelledCount++;
        // A cancellation fee (if any) still pays the driver via the normal
        // commission split — it just isn't a "completed ride" for the trip count.
        const cancellationFee = (ride as any).cancellationFee || 0;
        if (cancellationFee > 0) {
          const amount = hasSnapshot ? (ride as any).driverEarningsAmount : calculateDriverPayout(cancellationFee).netAmount;
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
      const amount = hasSnapshot
        ? (ride as any).driverEarningsAmount
        : calculateDriverPayout(ride.fare || 0, ride.bookingFee || 0, ride.serviceFee || 0, ride.zoneFee || 0, ride.waitingCharge || 0, ride.priorityFee || 0).netAmount;
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

    // Tips are bucketed the same way ride earnings are above, but kept in
    // entirely separate accumulators — never folded into totalEarnings/
    // todayEarnings/etc., per the 100%-driver / 0%-platform tip rule.
    let totalTips = 0, todayTips = 0, weekTips = 0, monthTips = 0;
    for (const tip of (tipsResult.data ?? []) as { amount: number; createdAt: string }[]) {
      const amount = Number(tip.amount) || 0;
      const createdAt = new Date(tip.createdAt);
      totalTips += amount;
      if (createdAt >= today) todayTips += amount;
      if (createdAt >= weekStart) weekTips += amount;
      if (createdAt >= monthStart) monthTips += amount;
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
      totalTips,
      todayTips,
      weekTips,
      monthTips,
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
    totalTips: 0, todayTips: 0, weekTips: 0, monthTips: 0,
  };
}
