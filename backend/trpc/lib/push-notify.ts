// Shared Expo push-sending helper. Extracted from
// notifications/notify-drivers/route.ts (no behavior change there) so a
// second call site — a single-driver tip notification — doesn't duplicate
// the batching/fetch logic.

import type { SupabaseClient } from '@supabase/supabase-js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export async function batchSendPush(
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

// Targets exactly one driver — deliberately not the broadcast-to-all-
// online-drivers query notifications.notifyDrivers uses. Called directly
// (not through a tRPC route) since a tip notification has no client-side
// trigger point of its own — it fires server-side, inside the same request
// that just ran create_tip().
export async function notifyDriverOfTip(
  supabaseAdmin: SupabaseClient,
  driverId: string,
  amount: number,
  rideId: string
): Promise<void> {
  const { data: driver } = await supabaseAdmin
    .from('drivers')
    .select('pushToken')
    .eq('id', driverId)
    .single();

  const pushToken = driver?.pushToken as string | null | undefined;
  if (!pushToken) return;

  const naira = Math.round(amount).toLocaleString('en-NG');
  await batchSendPush(
    [pushToken],
    'You got a tip! 🎉',
    `A rider tipped you ₦${naira}`,
    { type: 'tip_received', rideId, amount }
  );
}
