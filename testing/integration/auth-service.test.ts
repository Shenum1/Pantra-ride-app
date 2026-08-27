import { beforeEach, describe, expect, it, vi } from 'vitest';

// AuthService is Supabase-backed (auth.signUp/signInWithPassword/signOut/getSession),
// not Firebase Auth — mock @/lib/supabase's client, not firebase/auth. The previous
// version of this file mocked firebase/auth and asserted on a `.uid` field and on
// `getCurrentUser`/`signInWithGoogle` methods that don't exist on the current
// Supabase-backed AuthService, so none of its assertions were exercising real code.
const signUpMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const signOutMock = vi.fn();
const getSessionMock = vi.fn();
const onAuthStateChangeMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args: any[]) => signUpMock(...args),
      signInWithPassword: (...args: any[]) => signInWithPasswordMock(...args),
      signOut: (...args: any[]) => signOutMock(...args),
      getSession: (...args: any[]) => getSessionMock(...args),
      onAuthStateChange: (...args: any[]) => onAuthStateChangeMock(...args),
    },
    from: (...args: any[]) => fromMock(...args),
  },
}));

import { AuthService } from '@/lib/auth-service';

function makeBuilder(result: { data?: any; error?: any }) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    single: vi.fn(async () => result),
    then: (resolve: (v: typeof result) => any) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

describe('AuthService — Supabase-backed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockReturnValue(makeBuilder({ data: null, error: null }));
  });

  describe('signUpWithEmail — Registration', () => {
    it('valid data creates account and returns the Supabase user', async () => {
      const mockUser = { id: 'uid-001', email: 'jane@test.com' };
      signUpMock.mockResolvedValue({ data: { user: mockUser }, error: null });

      const user = await AuthService.signUpWithEmail('jane@test.com', 'SecurePass1!', 'Jane Doe');

      expect(user).toBeDefined();
      expect(user.id).toBe('uid-001');
      expect(signUpMock).toHaveBeenCalledOnce();
    });

    it('duplicate email throws error', async () => {
      signUpMock.mockResolvedValue({
        data: { user: null },
        error: { message: 'User already registered' },
      });

      await expect(
        AuthService.signUpWithEmail('existing@test.com', 'Pass123!', 'Test User'),
      ).rejects.toThrow('User already registered');
    });

    it('weak password throws error', async () => {
      signUpMock.mockResolvedValue({
        data: { user: null },
        error: { message: 'Password should be at least 6 characters.' },
      });

      await expect(
        AuthService.signUpWithEmail('user@test.com', '123', 'Test User'),
      ).rejects.toThrow('Password should be at least 6 characters.');
    });

    it('missing user in a successful-looking response still throws', async () => {
      signUpMock.mockResolvedValue({ data: { user: null }, error: null });

      await expect(
        AuthService.signUpWithEmail('user@test.com', 'Pass123!', 'Test User'),
      ).rejects.toThrow('Sign up failed');
    });
  });

  describe('signInWithEmail — Login', () => {
    it('valid credentials return user', async () => {
      const mockUser = { id: 'uid-002', email: 'rider@test.com' };
      signInWithPasswordMock.mockResolvedValue({ data: { user: mockUser }, error: null });

      const user = await AuthService.signInWithEmail('rider@test.com', 'test123');

      expect(user?.email).toBe('rider@test.com');
      expect(user?.id).toBe('uid-002');
    });

    it('wrong password throws error', async () => {
      signInWithPasswordMock.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      });

      await expect(
        AuthService.signInWithEmail('rider@test.com', 'wrongpassword'),
      ).rejects.toThrow('Invalid login credentials');
    });

    it('unregistered email throws error', async () => {
      signInWithPasswordMock.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      });

      await expect(
        AuthService.signInWithEmail('nobody@test.com', 'anypassword'),
      ).rejects.toThrow();
    });
  });

  describe('signOut', () => {
    it('resolves without error', async () => {
      signOutMock.mockResolvedValue({ error: null });

      await expect(AuthService.signOut()).resolves.not.toThrow();
      expect(signOutMock).toHaveBeenCalledOnce();
    });

    it('failure throws error', async () => {
      signOutMock.mockResolvedValue({ error: { message: 'Network error' } });

      await expect(AuthService.signOut()).rejects.toThrow('Network error');
    });
  });

  describe('getCurrentSession', () => {
    it('returns null when unauthenticated', async () => {
      getSessionMock.mockResolvedValue({ data: { session: null } });

      const session = await AuthService.getCurrentSession();
      expect(session).toBeNull();
    });

    it('returns the active session when authenticated', async () => {
      const mockSession = { access_token: 'token', user: { id: 'uid-003' } };
      getSessionMock.mockResolvedValue({ data: { session: mockSession } });

      const session = await AuthService.getCurrentSession();
      expect(session).toBe(mockSession);
    });
  });

  describe('onAuthStateChanged', () => {
    it('forwards the session user to the callback and returns an unsubscribe fn', () => {
      const unsubscribe = vi.fn();
      onAuthStateChangeMock.mockImplementation((cb: (event: string, session: any) => void) => {
        cb('SIGNED_IN', { user: { id: 'uid-004' } });
        return { data: { subscription: { unsubscribe } } };
      });

      const callback = vi.fn();
      const unsub = AuthService.onAuthStateChanged(callback);

      expect(callback).toHaveBeenCalledWith({ id: 'uid-004' });
      unsub();
      expect(unsubscribe).toHaveBeenCalledOnce();
    });
  });

  describe('getUserProfile', () => {
    it('returns the profile row when found', async () => {
      const profile = { uid: 'uid-005', email: 'p@test.com', role: 'rider' };
      fromMock.mockReturnValue(makeBuilder({ data: profile, error: null }));

      const result = await AuthService.getUserProfile('uid-005');
      expect(result).toEqual(profile);
    });

    it('returns null when the row is missing', async () => {
      fromMock.mockReturnValue(makeBuilder({ data: null, error: { message: 'not found' } }));

      const result = await AuthService.getUserProfile('missing-uid');
      expect(result).toBeNull();
    });
  });
});
