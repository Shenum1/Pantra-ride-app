import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuthStore';
import { usePrivacyStore } from '@/hooks/usePrivacyStore';
import { DEFAULT_RIDER_PREFERENCES, RiderAccountService, RiderPreferences } from '@/lib/rider-account-service';
import { pickPrivacyPrefs } from '@/lib/privacy-preferences';
import { cachePrivacyPrefs } from '@/lib/privacy-preferences-sync';

// Keeps the app-wide privacy store (ads, location) in step with what this
// screen loaded or changed, so a toggle takes effect immediately.
function syncPrivacyStore(userId: string, preferences: RiderPreferences) {
  const prefs = pickPrivacyPrefs(preferences);
  usePrivacyStore.getState().setRiderPrefs(prefs, true);
  void cachePrivacyPrefs(userId, prefs);
}

export function useRiderPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<RiderPreferences>(DEFAULT_RIDER_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user?.id || user.id === 'test-rider') {
      setPreferences(DEFAULT_RIDER_PREFERENCES);
      setIsLoading(false);
      return;
    }
    const userId = user.id;
    setIsLoading(true);
    RiderAccountService.getPreferences(userId)
      .then((result) => {
        if (!active) return;
        setPreferences(result);
        syncPrivacyStore(userId, result);
      })
      .catch((error) => console.error('Unable to load rider preferences:', error))
      .finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, [user?.id]);

  const updatePreference = useCallback(async <K extends keyof RiderPreferences>(key: K, value: RiderPreferences[K]) => {
    if (!user?.id || user.id === 'test-rider') return;
    const userId = user.id;
    const previous = preferences;
    const next = { ...previous, [key]: value };
    setPreferences(next);
    syncPrivacyStore(userId, next);
    try {
      await RiderAccountService.updatePreferences(userId, { [key]: value });
    } catch (error) {
      setPreferences(previous);
      syncPrivacyStore(userId, previous);
      throw error;
    }
  }, [preferences, user?.id]);

  return { preferences, isLoading, updatePreference };
}
