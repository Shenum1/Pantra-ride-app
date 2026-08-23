import { z } from 'zod';
import { publicProcedure } from '@/backend/trpc/create-context';
import { supabaseAdmin } from '@/backend/lib/supabase-admin';
import { batchSendPush } from '@/backend/trpc/lib/push-notify';

export default publicProcedure
  .input(
    z.object({
      pickupAddress: z.string(),
      fare: z.number(),
      rideId: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    if (!supabaseAdmin) {
      return { sent: 0, reason: 'supabaseAdmin not configured' };
    }

    const { data: drivers, error } = await supabaseAdmin
      .from('drivers')
      .select('id, pushToken')
      .eq('isOnline', true)
      .not('pushToken', 'is', null);

    if (error) {
      console.error('Failed to fetch online drivers:', error.message);
      return { sent: 0, reason: error.message };
    }

    const tokens = (drivers ?? [])
      .map((d: { id: string; pushToken: string | null }) => d.pushToken)
      .filter((t): t is string => !!t);

    if (tokens.length === 0) {
      return { sent: 0, reason: 'no online drivers with push tokens' };
    }

    const fare = Math.round(input.fare).toLocaleString('en-NG');
    const sent = await batchSendPush(
      tokens,
      'New Ride Request',
      `Pickup: ${input.pickupAddress} — ₦${fare}`,
      { type: 'new_ride_request', rideId: input.rideId }
    );

    return { sent };
  });
