import { AuthService } from './auth-service';

export type GoogleAuthRole = 'rider' | 'driver';

export interface GoogleSignInResult {
  userId: string;
  email: string;
  fullName: string | null;
  photoUrl: string | null;
  hasPhone: boolean;
}

// Role-agnostic: establishes only the base public.users row. Deciding rider vs.
// driver (and creating the public.drivers row) is the caller's job.
export async function finalizeGoogleUser(
  user: { id: string; email?: string | null },
  google: { email: string; fullName: string | null; photoUrl: string | null }
): Promise<GoogleSignInResult> {
  const email = user.email ?? google.email;
  const { fullName, photoUrl } = google;

  let profile = await AuthService.getUserProfile(user.id);
  if (!profile) {
    await AuthService.createMissingUserProfile(user.id, email, fullName ?? email.split('@')[0], 'rider');
    profile = await AuthService.getUserProfile(user.id);
  }

  // The on_auth_user_created trigger falls back to the email prefix for
  // displayName — patch in the real Google name/photo.
  if (fullName || photoUrl) {
    await AuthService.updateUserProfile(user.id, {
      displayName: fullName ?? profile?.displayName,
      photoURL: photoUrl ?? profile?.photoURL,
    });
  }

  return {
    userId: user.id,
    email,
    fullName,
    photoUrl,
    hasPhone: !!profile?.phoneNumber,
  };
}
