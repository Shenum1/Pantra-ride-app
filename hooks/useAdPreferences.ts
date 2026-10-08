import { usePrivacyStore } from '@/hooks/usePrivacyStore';
import { AdRequestOptions, buildAdRequestOptions, canServeAds } from '@/lib/ad-consent-policy';

/** Non-reactive read, for imperative ad loads (e.g. rewarded ads). */
export function getAdRequestState(): { adsReady: boolean; requestOptions: AdRequestOptions } {
  const { riderPrefs, riderPrefsLoaded, consent } = usePrivacyStore.getState();
  return {
    adsReady: canServeAds(consent),
    requestOptions: buildAdRequestOptions({
      personalizedAdsPreference: riderPrefs.personalizedAds,
      preferenceLoaded: riderPrefsLoaded,
      consent,
    }),
  };
}

/**
 * Single source of truth for every ad request in the app: whether ads may be
 * requested yet (UMP consent gathered + SDK initialised) and whether they
 * must be non-personalised (rider's Personalized Ads toggle, UMP choices, iOS ATT).
 */
export function useAdPreferences(): { adsReady: boolean; requestOptions: AdRequestOptions } {
  const adsReady = usePrivacyStore((s) => canServeAds(s.consent));
  const requestNonPersonalizedAdsOnly = usePrivacyStore(
    (s) =>
      buildAdRequestOptions({
        personalizedAdsPreference: s.riderPrefs.personalizedAds,
        preferenceLoaded: s.riderPrefsLoaded,
        consent: s.consent,
      }).requestNonPersonalizedAdsOnly
  );
  return { adsReady, requestOptions: { requestNonPersonalizedAdsOnly } };
}
