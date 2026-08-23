import { createClient, SupabaseClientOptions } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Expo Router's `web.output: "server"` mode evaluates this module in Node.js just to
// build the route graph, never to actually use realtime. Node <22 has no native
// WebSocket global, so supabase-js throws unless a `transport` is supplied. Since no
// real socket connection is ever opened from that context, a no-op stub satisfies the
// check without pulling in the `ws` package (which can't be bundled for native/web).
class NoopSocketTransport {
  constructor(_address: string | URL, _subprotocols?: string | string[]) {}
}
const isServer = typeof window === 'undefined';

type SupabaseAuthOptions = NonNullable<SupabaseClientOptions<'public'>['auth']>;

/**
 * Every Supabase client in this app must be built through this factory so the
 * SSR/realtime guard above is applied consistently — a bare `createClient()`
 * call anywhere else will crash the `web.output: "server"` route-graph build.
 */
export function createSupabaseAuthClient(authOverrides: SupabaseAuthOptions) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: authOverrides,
    ...(isServer ? { realtime: { transport: NoopSocketTransport as any } } : {}),
  });
}

export const supabase = createSupabaseAuthClient({
  storage: Platform.OS !== 'web' ? AsyncStorage : undefined,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
});
