import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authedProcedure } from '@/backend/trpc/create-context';
import { batchSendPush } from '@/backend/trpc/lib/push-notify';

// Broadcasts a new ride request to every online driver.
//
// Previously a PUBLIC procedure that pushed whatever pickupAddress/fare the
// caller sent to every online driver — an unauthenticated spam/phishing
// channel straight to drivers' lock screens. Now:
//   - the caller must be logged in (authedProcedure),
//   - rideId must be a ride the caller owns that is still 'pending',
//   - the pickup address and fare shown to drivers come from the DB row,
//     never from client input,
//   - repeat broadcasts for the same ride are throttled.
//
// pickupAddress/fare are still ACCEPTED (optional, ignored) so the existing
// client call in hooks/useRideStore.ts keeps working unchanged.
export const notifyDriversInput = z.object({
  rideId: z.string().uuid(),
  pickupAddress: z.string().optional(),
  fare: z.number().optional(),
});

// Best-effort, per-instance throttle (a serverless deploy may run several
// instances) — the ownership + 'pending' checks are the real gate; this only
// stops one rider hammering the button from re-pushing every few ms.
export const NOTIFY_THROTTLE_MS = 60_000;
const lastNotifiedAt = new Map<string, number>();

export function __resetNotifyThrottleForTests() {
  lastNotifiedAt.clear();
}

type SendPush = typeof batchSendPush;

export async function notifyDriversOfRide(
  db: SupabaseClient,
  userId: string,
  rideId: string,
  sendPush: SendPush = batchSendPush,
  now: number = Date.now()
): Promise<{ sent: number; reason?: string }> {
  const { data: ride, error: rideError } = await db
    .from('rides')
    .select('id, userId, status, pickupAddress, fare')
    .eq('id', rideId)
    .maybeSingle();

  if (rideError) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not load ride.' });
  }
  // Same NOT_FOUND for "doesn't exist" and "not yours", so this can't be used
  // to probe other riders' ride ids.
  if (!ride || ride.userId !== userId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Ride not found.' });
  }
  if (ride.status !== 'pending') {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Ride is no longer looking for a driver.' });
  }

  const previous = lastNotifiedAt.get(rideId);
  if (previous !== undefined && now - previous < NOTIFY_THROTTLE_MS) {
    return { sent: 0, reason: 'already notified recently' };
  }
  lastNotifiedAt.set(rideId, now);

  const { data: drivers, error } = await db
    .from('drivers')
    .select('id, pushToken')
    .eq('isOnline', true)
    .not('pushToken', 'is', null);

  if (error) {
    console.error('Failed to fetch online drivers:', error.message);
    return { sent: 0, reason: 'could not load online drivers' };
  }

  const tokens = (drivers ?? [])
    .map((d: { id: string; pushToken: string | null }) => d.pushToken)
    .filter((t): t is string => !!t);

  if (tokens.length === 0) {
    return { sent: 0, reason: 'no online drivers with push tokens' };
  }

  const pickupAddress = typeof ride.pickupAddress === 'string' && ride.pickupAddress ? ride.pickupAddress : 'Nearby pickup';
  const fareNumber = Number(ride.fare);
  const fareText = Number.isFinite(fareNumber) ? ` — ₦${Math.round(fareNumber).toLocaleString('en-NG')}` : '';

  const sent = await sendPush(tokens, 'New Ride Request', `Pickup: ${pickupAddress}${fareText}`, {
    type: 'new_ride_request',
    rideId: ride.id,
  });

  return { sent };
}

export default authedProcedure
  .input(notifyDriversInput)
  .mutation(({ ctx, input }) => notifyDriversOfRide(ctx.supabaseAdmin, ctx.userId, input.rideId));
