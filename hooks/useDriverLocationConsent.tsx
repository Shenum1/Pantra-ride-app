import React, { useCallback, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import LocationDisclosureModal from '@/components/LocationDisclosureModal';
import { getDriverLocationPermission } from '@/lib/driver-background-location';
import {
  BACKGROUND_PERMISSION_EXPLAINER,
  DriverTrackingMode,
  LocationPermissionStatus,
  trackingMode,
} from '@/lib/driver-location-policy';

// The only place a driver is asked for location permission. Order required by
// Google Play: our own disclosure first, then the foreground prompt, then —
// only if that was granted — the background ("Allow all the time") prompt.
// Denying at any step still lets the driver work with whatever access they
// have; the driver store falls back to foreground-only tracking.
//
// Render `disclosureModal` in the calling screen.
export function useDriverLocationConsent() {
  const [visible, setVisible] = useState(false);
  const resolverRef = useRef<((accepted: boolean) => void) | null>(null);

  const answerDisclosure = useCallback((accepted: boolean) => {
    setVisible(false);
    resolverRef.current?.(accepted);
    resolverRef.current = null;
  }, []);

  const ensureDriverLocationPermission = useCallback(async (): Promise<DriverTrackingMode> => {
    if (Platform.OS === 'web') return 'none';

    const current = await getDriverLocationPermission();
    if (current === 'background') return current;

    const accepted = await new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setVisible(true);
    });
    if (!accepted) return current;

    try {
      const foreground = await Location.requestForegroundPermissionsAsync();
      if (foreground.status !== 'granted') return 'none';

      await new Promise<void>((resolve) => {
        Alert.alert('Allow all the time', BACKGROUND_PERMISSION_EXPLAINER, [{ text: 'Continue', onPress: () => resolve() }], {
          cancelable: false,
        });
      });

      const background = await Location.requestBackgroundPermissionsAsync();
      return trackingMode(foreground.status as LocationPermissionStatus, background.status as LocationPermissionStatus);
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return getDriverLocationPermission();
    }
  }, []);

  const disclosureModal = (
    <LocationDisclosureModal
      visible={visible}
      onAccept={() => answerDisclosure(true)}
      onDeny={() => answerDisclosure(false)}
    />
  );

  return { ensureDriverLocationPermission, disclosureModal };
}
