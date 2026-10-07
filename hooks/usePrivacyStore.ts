import { create } from 'zustand';
import { AdConsentState, INITIAL_AD_CONSENT_STATE } from '@/lib/ad-consent-policy';
import { DEFAULT_RIDER_PRIVACY_PREFS, RiderPrivacyPrefs } from '@/lib/privacy-preferences';

// App-wide privacy state: the signed-in rider's privacy toggles (loaded by
// components/PrivacyBootstrap.tsx, kept current by hooks/useRiderPreferences.ts)
// and the Google UMP / iOS ATT consent state (written by lib/ad-consent.ts).
interface PrivacyStoreState {
  riderPrefs: RiderPrivacyPrefs;
  // True once the signed-in rider's prefs are known (cache or network), or
  // when nobody is signed in (defaults apply).
  riderPrefsLoaded: boolean;
  consent: AdConsentState;
  setRiderPrefs: (prefs: Partial<RiderPrivacyPrefs>, loaded?: boolean) => void;
  resetRiderPrefs: (loaded: boolean) => void;
  setConsent: (changes: Partial<AdConsentState>) => void;
}

export const usePrivacyStore = create<PrivacyStoreState>((set) => ({
  riderPrefs: DEFAULT_RIDER_PRIVACY_PREFS,
  riderPrefsLoaded: false,
  consent: INITIAL_AD_CONSENT_STATE,
  setRiderPrefs: (prefs, loaded) =>
    set((state) => ({
      riderPrefs: { ...state.riderPrefs, ...prefs },
      riderPrefsLoaded: loaded ?? state.riderPrefsLoaded,
    })),
  resetRiderPrefs: (loaded) => set({ riderPrefs: DEFAULT_RIDER_PRIVACY_PREFS, riderPrefsLoaded: loaded }),
  setConsent: (changes) => set((state) => ({ consent: { ...state.consent, ...changes } })),
}));
