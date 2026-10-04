import { supabase } from './supabase';
import { finalizeGoogleUser, GoogleAuthRole, GoogleSignInResult } from './google-profile';

export type { GoogleAuthRole, GoogleSignInResult } from './google-profile';

// Survives the same-tab round trip to Google and back to /auth-callback.
const ROLE_KEY = 'pantra_google_role';

function readStoredRole(): GoogleAuthRole {
  try {
    return sessionStorage.getItem(ROLE_KEY) === 'driver' ? 'driver' : 'rider';
  } catch {
    return 'rider';
  }
}

export class GoogleAuthService {
  // Leaves the app for Google; app/auth-callback.tsx finishes sign-in on return.
  static async signIn(role: GoogleAuthRole = 'rider'): Promise<GoogleSignInResult> {
    try {
      sessionStorage.setItem(ROLE_KEY, role);
    } catch {
      // Storage blocked — the callback falls back to rider.
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth-callback` },
    });
    if (error) throw new Error(error.message);

    return new Promise<GoogleSignInResult>(() => {});
  }

  static async completeRedirect(code: string): Promise<GoogleSignInResult & { role: GoogleAuthRole }> {
    const role = readStoredRole();
    try {
      sessionStorage.removeItem(ROLE_KEY);
    } catch {
      // ignore
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw new Error(error.message);
    const user = data.user;
    if (!user) throw new Error('Google sign-in failed — no user returned.');

    const meta = user.user_metadata ?? {};
    const result = await finalizeGoogleUser(user, {
      email: user.email ?? meta.email ?? '',
      fullName: meta.full_name ?? meta.name ?? null,
      photoUrl: meta.avatar_url ?? meta.picture ?? null,
    });
    return { ...result, role };
  }

  static async signOut(): Promise<void> {
    // Nothing Google-side to clear; AuthService.signOut ends the Supabase session.
  }
}
