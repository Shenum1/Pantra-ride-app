import React from 'react';
import { Platform } from 'react-native';
import { useAdPreferences } from '@/hooks/useAdPreferences';

// No web build of the native AdMob module exists — see .env.example. Real
// unit IDs come from EXPO_PUBLIC_ADMOB_*_BANNER_UNIT_ID; in dev (__DEV__) or
// when unset, Google's public TestIds.BANNER is used so the banner is safe
// to render before real IDs are configured.
function resolveBannerAdUnitId(): string | null {
  if (Platform.OS === 'web') return null;

  const envUnitId =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID
      : process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_UNIT_ID;

  if (__DEV__ || !envUnitId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { TestIds } = require('react-native-google-mobile-ads');
      return TestIds.BANNER;
    } catch {
      return null;
    }
  }

  return envUnitId;
}

export default function AdBanner() {
  // Nothing is requested until the UMP consent flow has run and the SDK is
  // initialised (lib/ad-consent.ts); personalisation follows the rider's
  // Personalized Ads toggle + consent (hooks/useAdPreferences.ts).
  const { adsReady, requestOptions } = useAdPreferences();
  if (Platform.OS === 'web' || !adsReady) return null;

  const adUnitId = resolveBannerAdUnitId();
  if (!adUnitId) return null;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { BannerAd, BannerAdSize } = require('react-native-google-mobile-ads');

  return (
    <BannerAd
      // Remount when personalisation changes so the next request uses it.
      key={requestOptions.requestNonPersonalizedAdsOnly ? 'npa' : 'pa'}
      unitId={adUnitId}
      requestOptions={requestOptions}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      onAdFailedToLoad={(error: unknown) => console.error('AdBanner: failed to load', error)}
    />
  );
}
