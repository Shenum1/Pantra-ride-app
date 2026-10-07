import { TrackingStatus } from '@/lib/ad-consent-policy';

// Web build: there are no AdMob ads on web (components/AdBanner.web.tsx,
// hooks/useRewardedAd.web.ts), so there is no UMP consent to gather either.
// This file keeps react-native-google-mobile-ads out of the web bundle — see
// lib/ad-consent.ts for the native implementation.

export function gatherAdConsent(): Promise<void> {
  return Promise.resolve();
}

export async function showAdPrivacyOptions(): Promise<void> {}

export async function requestTrackingAuthorization(): Promise<TrackingStatus> {
  return 'not-applicable';
}

export async function waitForAdsReady(): Promise<boolean> {
  return false;
}
