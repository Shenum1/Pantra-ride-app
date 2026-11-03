import { describe, expect, it } from 'vitest';
import {
  LOCATION_DISCLOSURE_TEXT,
  notificationCopy,
  shouldTrack,
  trackingMode,
} from '@/lib/driver-location-policy';

describe('shouldTrack', () => {
  it('tracks while the driver is online and waiting for rides', () => {
    expect(shouldTrack({ isOnline: true, hasCurrentRide: false })).toBe(true);
  });

  it('keeps tracking during a trip even though accepting a ride sets isOnline=false', () => {
    expect(shouldTrack({ isOnline: false, hasCurrentRide: true })).toBe(true);
  });

  it('stops once the driver is offline with no trip', () => {
    expect(shouldTrack({ isOnline: false, hasCurrentRide: false })).toBe(false);
  });
});

describe('trackingMode', () => {
  it('uses the background service only with both permissions', () => {
    expect(trackingMode('granted', 'granted')).toBe('background');
  });

  it('falls back to foreground-only when "Allow all the time" was refused', () => {
    expect(trackingMode('granted', 'denied')).toBe('foreground');
    expect(trackingMode('granted', 'undetermined')).toBe('foreground');
  });

  it('does not track without foreground permission, whatever background says', () => {
    expect(trackingMode('denied', 'granted')).toBe('none');
    expect(trackingMode('undetermined', 'undetermined')).toBe('none');
  });
});

describe('notificationCopy', () => {
  it('says the trip is in progress during a trip', () => {
    expect(notificationCopy(true)).toEqual({
      title: 'Trip in Progress',
      body: 'Tracking your location for real-time navigation and safety.',
    });
  });

  it('does not claim a trip while the driver is only online', () => {
    const copy = notificationCopy(false);
    expect(copy.title).toBe("You're online");
    expect(copy.title).not.toMatch(/trip/i);
  });
});

describe('LOCATION_DISCLOSURE_TEXT', () => {
  it('is the exact approved Google Play disclosure', () => {
    expect(LOCATION_DISCLOSURE_TEXT).toBe(
      'This app collects location data to enable real-time ride tracking, driver dispatch matching, and route navigation even when the app is closed, minimized, or not in use.'
    );
  });
});
