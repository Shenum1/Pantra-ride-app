import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';
import { finalizeGoogleUser, GoogleAuthRole, GoogleSignInResult } from './google-profile';

export type { GoogleAuthRole, GoogleSignInResult } from './google-profile';

let configured = false;

function ensureConfigured() {
  if (configured) return;

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  if (!webClientId) {
    throw new Error('Google Sign-In is not configured. Set EXPO_PUBLIC_GOOGLE_CLIENT_ID (and the iOS/Android client IDs) in .env.');
  }

  GoogleSignin.configure({
    webClientId,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
    offlineAccess: false,
  });
  configured = true;
}

// Native implementation. Web uses google-auth-service.web.ts (Supabase OAuth
// redirect), since this library's web build is a sponsor-only stub.
export class GoogleAuthService {
  static async signIn(_role?: GoogleAuthRole): Promise<GoogleSignInResult> {
    ensureConfigured();

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') {
      throw new Error('Google sign-in was cancelled.');
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      throw new Error('Google sign-in did not return an ID token.');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Google sign-in failed — no user returned.');

    return finalizeGoogleUser(data.user, {
      email: response.data.user.email,
      fullName: response.data.user.name ?? null,
      photoUrl: response.data.user.photo ?? null,
    });
  }

  static async completeRedirect(_code: string): Promise<GoogleSignInResult & { role: GoogleAuthRole }> {
    throw new Error('Google redirect sign-in is only used on web.');
  }

  static async signOut(): Promise<void> {
    try {
      await GoogleSignin.signOut();
    } catch {
      // No active Google session to sign out of — safe to ignore.
    }
  }
}
