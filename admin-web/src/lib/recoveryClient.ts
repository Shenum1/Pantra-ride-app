import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * A completely isolated Supabase client for the password-recovery flow: no
 * persisted storage, no auto-refresh, no URL-based session detection. It is
 * never wired into useAuth()'s onAuthStateChange listener, so an in-progress
 * password reset can never be mistaken for a real admin login. The session
 * this establishes (via verifyOtp) lives only in memory for the duration of
 * one reset attempt and must be explicitly discarded when the flow ends.
 *
 * Mirrors the mobile app's recoveryClient pattern in
 * lib/password-reset-service.ts.
 */
export const recoveryClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
