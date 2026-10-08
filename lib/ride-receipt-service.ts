import { supabase } from './supabase';
import { buildRideReceipt, ReceiptPerspective, RideReceipt, RideReceiptParties, RideReceiptSource } from './ride-receipt';

// Loads everything a ride receipt needs. RLS already limits rides/tips reads
// to the ride's own rider or driver. Riders can't read drivers rows and
// drivers can't read riders' users rows directly
// (supabase-schema-security-hardening.sql), so the other party's name/plate
// come from the RPCs that expose only the assigned party. These lookups are
// best-effort: a receipt without them is still a valid receipt, so their
// failures are swallowed rather than blocking it.

async function loadParties(ride: any, perspective: ReceiptPerspective): Promise<RideReceiptParties> {
  try {
    if (perspective === 'rider') {
      if (!ride.driverId) return {};
      const { data } = await supabase.rpc('get_ride_driver', { p_ride_id: ride.id });
      const driver = Array.isArray(data) ? data[0] : data;
      return {
        driverName: driver?.name ?? null,
        vehiclePlate: driver?.vehiclePlateNumber ?? driver?.vehicle?.licensePlate ?? null,
      };
    }
    // A ride booked for someone else names the actual passenger on the row.
    if (ride.passengerName) return { riderName: ride.passengerName };
    if (!ride.userId) return {};
    const { data } = await supabase.rpc('get_ride_rider_for_driver', { p_ride_id: ride.id });
    const rider = Array.isArray(data) ? data[0] : data;
    return { riderName: rider?.riderName ?? null };
  } catch {
    return {};
  }
}

async function loadTipAmount(rideId: string): Promise<number> {
  try {
    const { data, error } = await supabase.from('tips').select('amount').eq('rideId', rideId).eq('status', 'successful');
    if (error || !data) return 0;
    return data.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
  } catch {
    return 0;
  }
}

// null = the ride doesn't exist (or isn't visible to this account), or has no
// receipt (not completed, and not a cancellation that charged a fee).
export async function loadRideReceipt(rideId: string, perspective: ReceiptPerspective): Promise<RideReceipt | null> {
  // select('*') rather than a column list, so a database that hasn't run every
  // fee migration yet still returns the ride (missing fees just read as 0).
  const { data: ride, error } = await supabase.from('rides').select('*').eq('id', rideId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!ride) return null;

  const [parties, tip] = await Promise.all([loadParties(ride, perspective), loadTipAmount(rideId)]);
  return buildRideReceipt(ride as RideReceiptSource, perspective, parties, tip);
}
