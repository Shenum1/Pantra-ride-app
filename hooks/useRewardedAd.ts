import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type RewardedAdStatus = 'idle' | 'loading' | 'ready' | 'showing' | 'unsupported';
export type RewardedAdOutcome = 'earned' | 'dismissed' | 'error';

// No web build of the native AdMob module exists — see .env.example. Real
// unit IDs come from EXPO_PUBLIC_ADMOB_*_REWARDED_UNIT_ID; in dev (__DEV__)
// or when unset, Google's public TestIds.REWARDED is used so the feature is
// safe to exercise before real IDs are configured (never fabricate a fake
// reward instead — an unconfigured/unloadable ad just fails to show).
function resolveAdUnitId(): string | null {
  if (Platform.OS === 'web') return null;

  const envUnitId =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_UNIT_ID
      : process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_UNIT_ID;

  if (__DEV__ || !envUnitId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { TestIds } = require('react-native-google-mobile-ads');
      return TestIds.REWARDED;
    } catch {
      return null;
    }
  }

  return envUnitId;
}

export function useRewardedAd() {
  const [status, setStatus] = useState<RewardedAdStatus>(Platform.OS === 'web' ? 'unsupported' : 'idle');
  const adRef = useRef<any>(null);
  const unsubscribersRef = useRef<Array<() => void>>([]);

  const teardown = useCallback(() => {
    unsubscribersRef.current.forEach((unsub) => unsub());
    unsubscribersRef.current = [];
    adRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const watchAd = useCallback((): Promise<RewardedAdOutcome> => {
    if (Platform.OS === 'web') {
      return Promise.resolve('error');
    }

    const adUnitId = resolveAdUnitId();
    if (!adUnitId) {
      return Promise.resolve('error');
    }

    return new Promise((resolve) => {
      let earned = false;

      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { RewardedAd, RewardedAdEventType, AdEventType } = require('react-native-google-mobile-ads');
        const rewarded = RewardedAd.createForAdUnitId(adUnitId);
        adRef.current = rewarded;
        setStatus('loading');

        const onEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
          earned = true;
        });
        const onLoaded = rewarded.addAdEventListener(AdEventType.LOADED, () => {
          setStatus('showing');
          rewarded.show();
        });
        const onClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
          setStatus('idle');
          teardown();
          resolve(earned ? 'earned' : 'dismissed');
        });
        const onError = rewarded.addAdEventListener(AdEventType.ERROR, () => {
          setStatus('idle');
          teardown();
          resolve('error');
        });

        unsubscribersRef.current = [onEarned, onLoaded, onClosed, onError];
        rewarded.load();
      } catch (error) {
        console.error('useRewardedAd: failed to load rewarded ad', error);
        setStatus('idle');
        resolve('error');
      }
    });
  }, [teardown]);

  return { status, watchAd };
}
