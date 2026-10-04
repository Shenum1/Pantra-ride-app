import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  signInWithOAuth,
  exchangeCodeForSession,
  getUserProfile,
  createMissingUserProfile,
  updateUserProfile,
} = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getUserProfile: vi.fn(),
  createMissingUserProfile: vi.fn(),
  updateUserProfile: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithOAuth, exchangeCodeForSession } },
}));

vi.mock('@/lib/auth-service', () => ({
  AuthService: { getUserProfile, createMissingUserProfile, updateUserProfile },
}));

import { GoogleAuthService } from '@/lib/google-auth-service.web';

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
}

const googleUser = {
  id: 'user-1',
  email: 'ada@gmail.com',
  user_metadata: { full_name: 'Ada Obi', avatar_url: 'https://img/ada.png' },
};

describe('GoogleAuthService (web)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('sessionStorage', memoryStorage());
    vi.stubGlobal('window', { location: { origin: 'https://pantra.example' } });
    signInWithOAuth.mockResolvedValue({ error: null });
    exchangeCodeForSession.mockResolvedValue({ data: { user: googleUser }, error: null });
    getUserProfile.mockResolvedValue({ phoneNumber: '+2348000000000', displayName: 'ada' });
  });

  it('redirects to Google with the auth-callback URL', () => {
    void GoogleAuthService.signIn('driver');
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://pantra.example/auth-callback' },
    });
  });

  it('carries the chosen role across the redirect, then clears it', async () => {
    void GoogleAuthService.signIn('driver');
    const first = await GoogleAuthService.completeRedirect('code-1');
    expect(first.role).toBe('driver');

    const second = await GoogleAuthService.completeRedirect('code-2');
    expect(second.role).toBe('rider');
  });

  it('defaults to rider when no role was stored', async () => {
    const result = await GoogleAuthService.completeRedirect('code-1');
    expect(result.role).toBe('rider');
  });

  it('maps Google metadata into the profile and result', async () => {
    const result = await GoogleAuthService.completeRedirect('code-1');

    expect(exchangeCodeForSession).toHaveBeenCalledWith('code-1');
    expect(updateUserProfile).toHaveBeenCalledWith('user-1', {
      displayName: 'Ada Obi',
      photoURL: 'https://img/ada.png',
    });
    expect(result).toMatchObject({
      userId: 'user-1',
      email: 'ada@gmail.com',
      fullName: 'Ada Obi',
      photoUrl: 'https://img/ada.png',
      hasPhone: true,
    });
  });

  it('creates the users row when it is missing', async () => {
    getUserProfile.mockResolvedValueOnce(null).mockResolvedValueOnce({ phoneNumber: null });
    const result = await GoogleAuthService.completeRedirect('code-1');

    expect(createMissingUserProfile).toHaveBeenCalledWith('user-1', 'ada@gmail.com', 'Ada Obi', 'rider');
    expect(result.hasPhone).toBe(false);
  });

  it('surfaces a failed code exchange', async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ data: { user: null }, error: { message: 'invalid flow state' } });
    await expect(GoogleAuthService.completeRedirect('stale')).rejects.toThrow('invalid flow state');
  });

  it('surfaces an OAuth start failure', async () => {
    signInWithOAuth.mockResolvedValueOnce({ error: { message: 'provider is not enabled' } });
    await expect(GoogleAuthService.signIn('rider')).rejects.toThrow('provider is not enabled');
  });
});
