import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { FirebaseDriverService } from './firebase-driver-service';
import {
  DRIVER_BACKGROUND_LOCATION_ENABLED,
  DriverTrackingMode,
  LocationPermissionStatus,
  notificationCopy,
  trackingMode,
} from './driver-location-policy';

// Driver location while Pantra is minimised or closed (e.g. the driver tapped
// Navigate and is in Google Maps). Runs as an Android foreground service with a
// persistent notification. The task must be defined at module scope and this
// file imported from app/_layout.tsx, so the OS can wake the JS runtime and
// find the task even when no screen is mounted.
export const DRIVER_LOCATION_TASK = 'pantra-driver-location';

// The task has no React state, so it reads which driver to update from here.
// Cleared on stop, so a task that outlives its session stops itself.
const DRIVER_ID_KEY = 'pantra.bgLocation.driverId';

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(DRIVER_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error.message);
    return;
  }
  const latest = data?.locations?.[data.locations.length - 1];
  if (!latest) return;

  try {
    const driverId = await AsyncStorage.getItem(DRIVER_ID_KEY);
    if (!driverId) {
      await stopDriverBackgroundTracking();
      return;
    }
    await FirebaseDriverService.updateDriverLocation(driverId, latest.coords.latitude, latest.coords.longitude);
  } catch (taskError) {
    console.error('Error saving background location:', taskError);
  }
});

// Checks only — never shows a system prompt. Asking happens through the
// disclosure flow (hooks/useDriverLocationConsent.tsx).
export async function getDriverLocationPermission(): Promise<DriverTrackingMode> {
  try {
    const foreground = await Location.getForegroundPermissionsAsync();
    if (foreground.status !== 'granted') return 'none';
    // Switched off: never report 'background', so the driver store never starts the service.
    if (!DRIVER_BACKGROUND_LOCATION_ENABLED) return trackingMode(foreground.status as LocationPermissionStatus, 'denied');
    const background = await Location.getBackgroundPermissionsAsync();
    return trackingMode(foreground.status as LocationPermissionStatus, background.status as LocationPermissionStatus);
  } catch (error) {
    console.error('Error checking location permission:', error);
    return 'none';
  }
}

// Calling this again while running updates the notification text (e.g. when a
// trip starts or ends).
export async function startDriverBackgroundTracking(driverId: string, hasCurrentRide: boolean): Promise<boolean> {
  try {
    await AsyncStorage.setItem(DRIVER_ID_KEY, driverId);
    const copy = notificationCopy(hasCurrentRide);
    await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 10,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: copy.title,
        notificationBody: copy.body,
        notificationColor: '#0F172A',
        killServiceOnDestroy: false,
      },
    });
    return true;
  } catch (error) {
    console.error('Error starting background location:', error);
    return false;
  }
}

// Stops the foreground service, which removes its notification straight away.
export async function stopDriverBackgroundTracking(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRIVER_ID_KEY);
    if (await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
    }
  } catch (error) {
    console.error('Error stopping background location:', error);
  }
}
