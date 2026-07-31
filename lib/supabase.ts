import { createClient } from '@supabase/supabase-js';
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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS !== 'web' ? AsyncStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  ...(isServer ? { realtime: { transport: NoopSocketTransport as any } } : {}),
});
