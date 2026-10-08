// Pure decision logic for ad consent / personalisation. No React Native or
// AdMob imports here so it can be unit tested (testing/unit/ad-consent-policy.test.ts)
// and shared by the native (lib/ad-consent.ts) and web (lib/ad-consent.web.ts)
// consent modules, hooks/useAdPreferences.ts and the privacy screen.

// Mirrors react-native-google-mobile-ads' AdsConsentStatus string values.
export type AdConsentStatus = 'UNKNOWN' | 'REQUIRED' | 'NOT_REQUIRED' | 'OBTAINED';

// iOS App Tracking Transparency result. 'not-applicable' = not iOS (Android has
// no ATT); 'unavailable' = iOS but the ATT module/API couldn't be used (e.g. a
// binary built before expo-tracking-transparency was added).
export type TrackingStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable' | 'not-applicable';

export interface AdConsentState {
  // True once the UMP flow has finished for this app launch (success or failure).
  gathered: boolean;
  status: AdConsentStatus;
  // UMP's own verdict on whether ads may be requested at all.
  canRequestAds: boolean;
  // UMP says a "Privacy options" entry point must be offered in the app.
  privacyOptionsRequired: boolean;
  // From the TCF string when the user answered a UMP form: did they allow
  // "select personalised ads"? null = no such signal (form not shown/applicable).
  personalisationConsented: boolean | null;
  tracking: TrackingStatus;
  // mobileAds().initialize() has completed.
  sdkInitialized: boolean;
}

export const INITIAL_AD_CONSENT_STATE: AdConsentState = {
  gathered: false,
  status: 'UNKNOWN',
  canRequestAds: false,
  privacyOptionsRequired: false,
  personalisationConsented: null,
  tracking: 'undetermined',
  sdkInitialized: false,
};

export interface AdRequestOptions {
  requestNonPersonalizedAdsOnly: boolean;
}

/** Ads may be requested only after the consent flow ran, UMP allows it and the SDK is initialised. */
export function canServeAds(consent: AdConsentState): boolean {
  return consent.gathered && consent.canRequestAds && consent.sdkInitialized;
}

/** Whether the consent layer (UMP + ATT) permits personalised ads. */
export function consentAllowsPersonalisation(consent: AdConsentState): boolean {
  if (!consent.gathered || !consent.canRequestAds) return false;
  if (consent.status !== 'OBTAINED' && consent.status !== 'NOT_REQUIRED') return false;
  if (consent.personalisationConsented === false) return false;
  return consent.tracking === 'granted' || consent.tracking === 'not-applicable';
}

/**
 * Personalised ads only when the rider opted in (Privacy > Personalized Ads,
 * default off) AND the consent layer allows it. Anything unknown/unloaded
 * falls back to non-personalised.
 */
export function buildAdRequestOptions(input: {
  personalizedAdsPreference: boolean;
  preferenceLoaded: boolean;
  consent: AdConsentState;
}): AdRequestOptions {
  const personalised =
    input.preferenceLoaded && input.personalizedAdsPreference && consentAllowsPersonalisation(input.consent);
  return { requestNonPersonalizedAdsOnly: !personalised };
}

/**
 * Ask for iOS ATT only when it could actually change something: the rider
 * wants personalised ads, UMP permits ads and the prompt has never been answered.
 */
export function shouldRequestTracking(input: {
  platform: string;
  personalizedAdsPreference: boolean;
  consent: AdConsentState;
}): boolean {
  return (
    input.platform === 'ios' &&
    input.personalizedAdsPreference &&
    input.consent.gathered &&
    input.consent.canRequestAds &&
    input.consent.tracking === 'undetermined'
  );
}

/** Maps a UMP consent-info status string to our type (unknown values -> 'UNKNOWN'). */
export function normaliseConsentStatus(value: unknown): AdConsentStatus {
  return value === 'REQUIRED' || value === 'NOT_REQUIRED' || value === 'OBTAINED' ? value : 'UNKNOWN';
}

/** Maps an expo-tracking-transparency permission status to TrackingStatus. */
export function normaliseTrackingStatus(value: unknown): TrackingStatus {
  return value === 'granted' || value === 'denied' || value === 'undetermined' ? value : 'unavailable';
}

/** EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS: comma/whitespace separated hashed device IDs. */
export function parseTestDeviceIds(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

export type DebugGeographyName = 'EEA' | 'NOT_EEA' | 'REGULATED_US_STATE' | 'OTHER';

/** EXPO_PUBLIC_ADMOB_CONSENT_DEBUG_GEOGRAPHY: EEA | NOT_EEA | REGULATED_US_STATE | OTHER (case-insensitive). */
export function parseDebugGeography(raw: string | undefined | null): DebugGeographyName | null {
  const value = (raw ?? '').trim().toUpperCase();
  return value === 'EEA' || value === 'NOT_EEA' || value === 'REGULATED_US_STATE' || value === 'OTHER'
    ? value
    : null;
}
