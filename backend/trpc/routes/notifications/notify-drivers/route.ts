import { z } from 'zod';
import { publicProcedure } from '@/backend/trpc/create-context';
import { supabaseAdmin } from '@/backend/lib/supabase-admin';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function batchSendPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<number> {
  let sent = 0;
  // Expo supports up to 100 messages per request
  for (let i = 0; i < tokens.length; i += 100) {
    const chunk = tokens.slice(i, i + 100);
    const messages = chunk.map((token) => ({
      to: token,
      title,
      body,
      data,
      sound: 'default',
      priority: 'high',
      channelId: 'default',
    }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });
      if (res.ok) sent += chunk.length;
    } catch (err) {
      console.error('Expo push batch failed:', err);
    }
  }
  return sent;
}

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
