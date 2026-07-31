import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// This client only ever runs in Node.js (server-side admin routes). Node <22 has no
// native WebSocket global, and supabase-js eagerly constructs a RealtimeClient (even
// though these admin queries never use realtime), so it throws unless a `transport` is
// supplied. No real socket connection is ever opened here, so a no-op stub is enough.
class NoopSocketTransport {
  constructor(_address: string | URL, _subprotocols?: string | string[]) {}
}

export const supabaseAdmin: SupabaseClient | null =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        realtime: { transport: NoopSocketTransport as any },
      })
    : null;
