import AsyncStorage from '@react-native-async-storage/async-storage';
import { RiderAccountService } from '@/lib/rider-account-service';
import { pickPrivacyPrefs, RiderPrivacyPrefs } from '@/lib/privacy-preferences';

// Per-device cache of the rider's privacy toggles so location/ads can honour
// them on the next cold start without waiting for (or failing on) the network.
const cacheKey = (userId: string) => `rider_privacy_prefs:${userId}`;

export async function loadCachedPrivacyPrefs(userId: string): Promise<RiderPrivacyPrefs | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    return raw ? pickPrivacyPrefs(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export async function cachePrivacyPrefs(userId: string, prefs: RiderPrivacyPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(prefs));
  } catch {
    // Cache is best-effort.
  }
}

/** Fetches rider_preferences and refreshes the cache. Null when the fetch failed. */
export async function refreshPrivacyPrefs(userId: string): Promise<RiderPrivacyPrefs | null> {
  try {
    const prefs = pickPrivacyPrefs(await RiderAccountService.getPreferences(userId));
    await cachePrivacyPrefs(userId, prefs);
    return prefs;
  } catch (error) {
    console.error('Unable to load rider privacy preferences:', error);
    return null;
  }
}
