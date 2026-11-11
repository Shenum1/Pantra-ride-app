import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession } },
}));

import { AuthService } from '@/lib/auth-service';

// Decides whether rider sign-up skips the email-code screen (app/signup.tsx):
// with "Confirm email" off in Supabase, signUp returns a session for the new
// account and the rider goes straight home.
describe('AuthService.hasSessionFor', () => {
  beforeEach(() => getSession.mockReset());

  it('is true when Supabase signed the new account straight in', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'new-rider' } } } });
    await expect(AuthService.hasSessionFor('new-rider')).resolves.toBe(true);
  });

  it('is false while email confirmation is pending (no session)', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(AuthService.hasSessionFor('new-rider')).resolves.toBe(false);
  });

  it('ignores a leftover session from a different, earlier account', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'previous-user' } } } });
    await expect(AuthService.hasSessionFor('new-rider')).resolves.toBe(false);
  });
});
