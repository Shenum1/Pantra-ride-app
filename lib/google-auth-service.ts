import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';
import { AuthService } from './auth-service';

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

export interface GoogleSignInResult {
  userId: string;
  email: string;
  fullName: string | null;
  photoUrl: string | null;
  hasPhone: boolean;
}

// Shared by both rider (useAuthStore) and driver (useDriverAuthStore) sign-in —
// role-agnostic: it only establishes the Supabase identity and the base
// public.users row. Deciding rider vs. driver (and creating the public.drivers
// row) is the caller's job, same split of responsibility signUpWithEmail already
// has vs. DriverAuthService.signUpWithEmail.
export class GoogleAuthService {
  static async signIn(): Promise<GoogleSignInResult> {
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

    const fullName = response.data.user.name ?? null;
    const photoUrl = response.data.user.photo ?? null;
    const email = data.user.email ?? response.data.user.email;

    let profile = await AuthService.getUserProfile(data.user.id);
    if (!profile) {
      await AuthService.createMissingUserProfile(data.user.id, email, fullName ?? email.split('@')[0], 'rider');
      profile = await AuthService.getUserProfile(data.user.id);
    }

    // The on_auth_user_created trigger falls back to the email prefix for
    // displayName (Google's identity claims don't populate raw_user_meta_data's
    // displayName key) — patch in the real Google name/photo so it isn't stuck
    // looking like an email-based account.
    if (fullName || photoUrl) {
      await AuthService.updateUserProfile(data.user.id, {
        displayName: fullName ?? profile?.displayName,
        photoURL: photoUrl ?? profile?.photoURL,
      });
    }

    return {
      userId: data.user.id,
      email,
      fullName,
      photoUrl,
      hasPhone: !!profile?.phoneNumber,
    };
  }

  static async signOut(): Promise<void> {
    try {
      await GoogleSignin.signOut();
    } catch {
      // No active Google session to sign out of — safe to ignore.
    }
  }
}
