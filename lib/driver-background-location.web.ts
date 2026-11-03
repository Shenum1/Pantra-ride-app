import type { DriverTrackingMode } from './driver-location-policy';

// Web has no background location or TaskManager. The driver store never calls
// these on web (it returns early), but app/_layout.tsx imports this module.
export const DRIVER_LOCATION_TASK = 'pantra-driver-location';

export async function getDriverLocationPermission(): Promise<DriverTrackingMode> {
  return 'none';
}

export async function startDriverBackgroundTracking(_driverId: string, _hasCurrentRide: boolean): Promise<boolean> {
  return false;
}

export async function stopDriverBackgroundTracking(): Promise<void> {}
