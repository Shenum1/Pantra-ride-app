import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuthStore';
import { DEFAULT_RIDER_PREFERENCES, RiderAccountService, RiderPreferences } from '@/lib/rider-account-service';

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
    setIsLoading(true);
    RiderAccountService.getPreferences(user.id)
      .then((result) => active && setPreferences(result))
      .catch((error) => console.error('Unable to load rider preferences:', error))
      .finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, [user?.id]);

  const updatePreference = useCallback(async <K extends keyof RiderPreferences>(key: K, value: RiderPreferences[K]) => {
    if (!user?.id || user.id === 'test-rider') return;
    const previous = preferences;
    setPreferences({ ...previous, [key]: value });
    try {
      await RiderAccountService.updatePreferences(user.id, { [key]: value });
    } catch (error) {
      setPreferences(previous);
      throw error;
    }
  }, [preferences, user?.id]);

  return { preferences, isLoading, updatePreference };
}
