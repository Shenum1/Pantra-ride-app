import { createSupabaseAuthClient } from './supabase';
import { UserRole } from './auth-service';

// A completely isolated client: no persisted storage, no auto-refresh, and
// never wired into onAuthStateChange anywhere. useAuthStore/useDriverAuthStore
// both subscribe to the shared `supabase` client's auth state — if the recovery
// session were established there, those stores could mistake an in-progress
// password reset for a real login. This client's session lives only for the
// duration of one reset attempt and is explicitly discarded at the end.
const recoveryClient = createSupabaseAuthClient({
  autoRefreshToken: false,
  persistSession: false,
  detectSessionInUrl: false,
});

const MIN_RESPONSE_DELAY_MS = 900;

async function withMinDelay<T>(promise: Promise<T>, minMs: number = MIN_RESPONSE_DELAY_MS): Promise<T> {
  const start = Date.now();
  const result = await promise;
  const elapsed = Date.now() - start;
  if (elapsed < minMs) {
    await new Promise((resolve) => setTimeout(resolve, minMs - elapsed));
  }
  return result;
}

/**
 * Always resolves, regardless of whether the email belongs to an account —
 * Supabase's own resetPasswordForEmail is already generic here, and the
 * minimum-delay wrapper prevents a response-timing side channel on top of that.
 * Callers should always show the same message and always advance the UI,
 * never branch on this throwing.
 */
export async function requestPasswordResetEmail(email: string): Promise<void> {
  await withMinDelay(
    recoveryClient.auth.resetPasswordForEmail(email.trim().toLowerCase()).catch((error) => {
      console.warn('Password reset request error (suppressed from UI):', error?.message);
    })
  );
}

/**
 * Exchanges the emailed OTP code for a real (isolated, unpersisted) session.
 * Throws on an invalid/expired code — that error is safe to show verbatim,
 * since reaching this step already required knowing the email address.
 */
export async function verifyResetCode(email: string, code: string): Promise<void> {
  const { error } = await recoveryClient.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'recovery',
  });
  if (error) throw new Error(error.message);
}

/**
 * Sets the new password on the now-authenticated recovery session, records
 * the reset event, and returns the account's role so the caller can route
 * back to the correct login screen.
 */
export async function completePasswordReset(newPassword: string): Promise<UserRole> {
  const { data: updateData, error: updateError } = await recoveryClient.auth.updateUser({ password: newPassword });
  if (updateError) throw new Error(updateError.message);

  const uid = updateData.user?.id;
  if (!uid) throw new Error('Password reset failed — no user on the recovery session');

  const { data: profile, error: profileError } = await recoveryClient
    .from('users')
    .select('role')
    .eq('uid', uid)
    .single();
  if (profileError || !profile) throw new Error('Could not determine account type after reset');

  const role = profile.role as UserRole;

  const { error: eventError } = await recoveryClient
    .from('password_reset_events')
    .insert({ userId: uid, method: 'email' });
  if (eventError) {
    console.warn('Failed to record password reset event:', eventError.message);
  }

  return role;
}

/** Invalidates the recovery session/token. Always call this once the flow ends, success or not. */
export async function discardRecoverySession(): Promise<void> {
  try {
    await recoveryClient.auth.signOut();
  } catch (error) {
    console.warn('Failed to discard recovery session:', error);
  }
}
