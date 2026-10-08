import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/hooks/useAuthStore';
import { usePrivacyStore } from '@/hooks/usePrivacyStore';
import { gatherAdConsent, requestTrackingAuthorization } from '@/lib/ad-consent';
import { shouldRequestTracking } from '@/lib/ad-consent-policy';
import { loadCachedPrivacyPrefs, refreshPrivacyPrefs } from '@/lib/privacy-preferences-sync';

// Mounted once in app/_layout.tsx (inside AuthProvider). Renders nothing.
//  1. Runs the Google UMP consent flow at app start, before any ad request.
//  2. Loads the signed-in rider's privacy toggles into hooks/usePrivacyStore.ts
//     (cached copy first, then network) so ads and location can honour them.
//  3. On iOS, asks for App Tracking Transparency only once a rider has opted
//     into personalised ads — never for riders who haven't.
const PREFS_TIMEOUT_MS = 5000;

export function PrivacyBootstrap() {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const trackingRequestedRef = useRef(false);

  useEffect(() => {
    void gatherAdConsent();
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const store = usePrivacyStore.getState();
    if (!userId || userId === 'test-rider') {
      store.resetRiderPrefs(true);
      return;
    }

    let active = true;
    store.resetRiderPrefs(false);
    void (async () => {
      const cached = await loadCachedPrivacyPrefs(userId);
      if (!active) return;
      if (cached) usePrivacyStore.getState().setRiderPrefs(cached, true);

      // No cached copy (first launch on this device): don't hold the home
      // screen hostage to a slow network — after PREFS_TIMEOUT_MS fall back to
      // the defaults (location on, personalised ads off); the real values
      // still apply as soon as they arrive.
      const fallback = setTimeout(() => {
        if (active && !usePrivacyStore.getState().riderPrefsLoaded) {
          usePrivacyStore.getState().setRiderPrefs({}, true);
        }
      }, PREFS_TIMEOUT_MS);

      const fresh = await refreshPrivacyPrefs(userId);
      clearTimeout(fallback);
      if (!active) return;
      usePrivacyStore.getState().setRiderPrefs(fresh ?? {}, true);
    })();
    return () => {
      active = false;
    };
  }, [authLoading, userId]);

  const wantsTrackingPrompt = usePrivacyStore((s) =>
    shouldRequestTracking({
      platform: Platform.OS,
      personalizedAdsPreference: s.riderPrefsLoaded && s.riderPrefs.personalizedAds,
      consent: s.consent,
    })
  );

  useEffect(() => {
    if (!wantsTrackingPrompt || trackingRequestedRef.current) return;
    trackingRequestedRef.current = true;
    void requestTrackingAuthorization();
  }, [wantsTrackingPrompt]);

  return null;
}
