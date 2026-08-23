import React from 'react';
import { Platform } from 'react-native';

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
  if (Platform.OS === 'web') return null;

  const adUnitId = resolveBannerAdUnitId();
  if (!adUnitId) return null;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { BannerAd, BannerAdSize } = require('react-native-google-mobile-ads');

  return (
    <BannerAd
      unitId={adUnitId}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      onAdFailedToLoad={(error: unknown) => console.error('AdBanner: failed to load', error)}
    />
  );
}
