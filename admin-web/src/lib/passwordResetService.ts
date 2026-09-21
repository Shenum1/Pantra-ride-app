import { recoveryClient } from './recoveryClient';

const MIN_RESPONSE_DELAY_MS = 900;

// Pads a promise out to a minimum duration — prevents a fast-vs-slow response
// timing side channel from revealing whether an email belongs to an account,
// on top of resetPasswordForEmail's own content already being generic.
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
 * Always resolves, regardless of whether the email belongs to an account.
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
 * Throws on an invalid/expired code — safe to show verbatim, since reaching
 * this step already required knowing the email address.
 */
export async function verifyResetCode(email: string, code: string): Promise<void> {
  const { error } = await recoveryClient.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'recovery',
  });
  if (error) throw new Error(error.message);
}

/** Sets the new password on the now-authenticated recovery session. */
export async function completePasswordReset(newPassword: string): Promise<void> {
  const { error } = await recoveryClient.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

/** Invalidates the recovery session/token. Always call this once the flow ends, success or not. */
export async function discardRecoverySession(): Promise<void> {
  try {
    await recoveryClient.auth.signOut();
  } catch (error) {
    console.warn('Failed to discard recovery session:', error);
  }
}
