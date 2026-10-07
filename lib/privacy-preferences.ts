// Pure helpers for the rider privacy toggles (app/privacy.tsx) that other
// parts of the app actually act on. Unit tested in
// testing/unit/privacy-preferences.test.ts.

export interface RiderPrivacyPrefs {
  // Off: the app never reads the rider's GPS position (home map, weather,
  // nearby places, "Current Location" pickup); pickup is entered manually.
  locationSharing: boolean;
  // On: ads may be personalised (still subject to UMP consent and iOS ATT).
  personalizedAds: boolean;
  // Off: the rider's profile photo is withheld from drivers — enforced in the
  // database by get_rider_photos_for_driver() (supabase-schema-rider-privacy.sql).
  profileVisibility: boolean;
}

// Location sharing and profile visibility are opt-out (the app needs the
// first for its core flow, and showing a photo to an assigned driver is the
// norm); personalised ads are opt-in. Keep in sync with the column defaults in
// database/schemas/supabase-schema-rider-privacy.sql.
export const DEFAULT_RIDER_PRIVACY_PREFS: RiderPrivacyPrefs = {
  locationSharing: true,
  personalizedAds: false,
  profileVisibility: true,
};

export function pickPrivacyPrefs(source: Partial<RiderPrivacyPrefs> | null | undefined): RiderPrivacyPrefs {
  return {
    locationSharing: typeof source?.locationSharing === 'boolean' ? source.locationSharing : DEFAULT_RIDER_PRIVACY_PREFS.locationSharing,
    personalizedAds: typeof source?.personalizedAds === 'boolean' ? source.personalizedAds : DEFAULT_RIDER_PRIVACY_PREFS.personalizedAds,
    profileVisibility: typeof source?.profileVisibility === 'boolean' ? source.profileVisibility : DEFAULT_RIDER_PRIVACY_PREFS.profileVisibility,
  };
}

export type LocationAccess = 'wait' | 'allowed' | 'disabled';

/**
 * Whether the rider-side location store may read the device position.
 * 'wait' while we don't yet know who is signed in or what they chose, so a
 * rider who turned sharing off never has their position read, even briefly.
 */
export function resolveLocationAccess(input: {
  authLoading: boolean;
  isSignedInRider: boolean;
  prefsLoaded: boolean;
  locationSharing: boolean;
}): LocationAccess {
  if (input.authLoading) return 'wait';
  if (!input.isSignedInRider) return 'allowed';
  if (!input.prefsLoaded) return 'wait';
  return input.locationSharing ? 'allowed' : 'disabled';
}
