// Pure decision logic for driver location tracking. No React Native or Expo
// imports here so it can be unit tested (testing/unit/driver-location-policy.test.ts)
// and shared by lib/driver-background-location.ts, hooks/useDriverStore.ts and
// the disclosure modal.

// Background location is switched off for the first Play release so it needs no
// background-location or foreground-service declaration. Drivers are tracked
// only while the app is open. Must match app.json: true only when
// ACCESS_BACKGROUND_LOCATION and FOREGROUND_SERVICE_LOCATION are in
// android.permissions (checked by testing/unit/driver-location-policy.test.ts).
// Steps to turn it back on: docs/play-store-listing.md, "Turning background location back on".
export const DRIVER_BACKGROUND_LOCATION_ENABLED = false;

// Google Play's prominent disclosure for background location. Shown to drivers
// before any native location prompt — keep the wording exactly as approved.
export const LOCATION_DISCLOSURE_TEXT =
  'This app collects location data to enable real-time ride tracking, driver dispatch matching, and route navigation even when the app is closed, minimized, or not in use.';

// Shown between the foreground and background prompts. On Android 11+ the
// background request opens the system settings page instead of a dialog.
export const BACKGROUND_PERMISSION_EXPLAINER =
  'On the next screen, choose "Allow all the time" so riders can keep seeing where you are while you use another app for navigation.';

export type LocationPermissionStatus = 'granted' | 'denied' | 'undetermined';

// 'background' = foreground service + TaskManager task (keeps running when
// Pantra is minimised or closed); 'foreground' = watchPositionAsync while the
// app is open; 'none' = no location access at all.
export type DriverTrackingMode = 'background' | 'foreground' | 'none';

// Accepting a ride sets drivers.isOnline=false in the database (busy, not
// available for new pickups) until the ride ends, so "online" alone would stop
// tracking mid-trip — exactly when the rider is watching the map.
export function shouldTrack(state: { isOnline: boolean; hasCurrentRide: boolean }): boolean {
  return state.isOnline || state.hasCurrentRide;
}

export function trackingMode(
  foreground: LocationPermissionStatus,
  background: LocationPermissionStatus
): DriverTrackingMode {
  if (foreground !== 'granted') return 'none';
  return background === 'granted' ? 'background' : 'foreground';
}

export interface TrackingNotificationCopy {
  title: string;
  body: string;
}

// Text of the persistent foreground-service notification shown while
// background tracking runs.
export function notificationCopy(hasCurrentRide: boolean): TrackingNotificationCopy {
  return hasCurrentRide
    ? { title: 'Trip in Progress', body: 'Tracking your location for real-time navigation and safety.' }
    : { title: "You're online", body: 'Pantra is using your location to match you with nearby riders.' };
}
