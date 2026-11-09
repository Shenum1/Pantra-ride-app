import { describe, expect, it } from 'vitest';

import {
  MOVING_ROUTE_POLICY,
  bearingDegrees,
  distanceMeters,
  distanceToPolylineMeters,
  isInsidePaddedBounds,
  nearestPolylineIndex,
  shouldRefetchMovingRoute,
  trimPolylineFrom,
} from '@/lib/map-geometry';

// One thousandth of a degree of latitude is ~111.2 m everywhere.
const ORIGIN = { latitude: 9.0, longitude: 7.0 };
const north = (meters: number) => ({ latitude: ORIGIN.latitude + meters / 111_195, longitude: ORIGIN.longitude });
const east = (point: { latitude: number; longitude: number }, meters: number) => ({
  latitude: point.latitude,
  longitude: point.longitude + meters / (111_195 * Math.cos((point.latitude * Math.PI) / 180)),
});

// A straight 400 m road running north from ORIGIN.
const ROAD = [north(0), north(100), north(200), north(300), north(400)];

describe('distanceMeters', () => {
  it('measures short distances to within a metre', () => {
    expect(distanceMeters(ORIGIN, north(250))).toBeCloseTo(250, 0);
    expect(distanceMeters(ORIGIN, east(ORIGIN, 80))).toBeCloseTo(80, 0);
  });

  it('is zero for the same point', () => {
    expect(distanceMeters(ORIGIN, ORIGIN)).toBe(0);
  });
});

describe('bearingDegrees', () => {
  it('returns compass bearings 0-360', () => {
    expect(bearingDegrees(ORIGIN, north(100))).toBeCloseTo(0, 1);
    expect(bearingDegrees(ORIGIN, east(ORIGIN, 100))).toBeCloseTo(90, 1);
    expect(bearingDegrees(north(100), ORIGIN)).toBeCloseTo(180, 1);
    expect(bearingDegrees(ORIGIN, east(ORIGIN, -100))).toBeCloseTo(270, 1);
  });
});

describe('nearestPolylineIndex / distanceToPolylineMeters', () => {
  it('finds the segment the point is beside', () => {
    const beside = east(north(250), 20);
    expect(nearestPolylineIndex(beside, ROAD)).toBe(2);
    expect(distanceToPolylineMeters(beside, ROAD)).toBeCloseTo(20, 0);
  });

  it('measures to the nearest end beyond the route', () => {
    expect(distanceToPolylineMeters(north(450), ROAD)).toBeCloseTo(50, 0);
  });

  it('handles empty and single-point routes', () => {
    expect(nearestPolylineIndex(ORIGIN, [])).toBe(-1);
    expect(distanceToPolylineMeters(ORIGIN, [])).toBe(Infinity);
    expect(distanceToPolylineMeters(north(30), [ORIGIN])).toBeCloseTo(30, 0);
  });
});

describe('trimPolylineFrom', () => {
  it('drops the part already driven and starts at the vehicle', () => {
    const vehicle = east(north(150), 5);
    const trimmed = trimPolylineFrom(vehicle, ROAD);

    expect(trimmed[0]).toEqual(vehicle);
    expect(trimmed.slice(1)).toEqual(ROAD.slice(2));
  });

  it('leaves routes too short to trim unchanged', () => {
    expect(trimPolylineFrom(ORIGIN, [north(10)])).toEqual([north(10)]);
    expect(trimPolylineFrom(ORIGIN, [])).toEqual([]);
  });
});

describe('isInsidePaddedBounds', () => {
  const bounds = { southWest: { latitude: 9.0, longitude: 7.0 }, northEast: { latitude: 9.1, longitude: 7.1 } };

  it('accepts points comfortably on screen', () => {
    expect(isInsidePaddedBounds({ latitude: 9.05, longitude: 7.05 }, bounds)).toBe(true);
  });

  it('rejects points near or past the edge', () => {
    expect(isInsidePaddedBounds({ latitude: 9.095, longitude: 7.05 }, bounds)).toBe(false);
    expect(isInsidePaddedBounds({ latitude: 9.05, longitude: 7.005 }, bounds)).toBe(false);
    expect(isInsidePaddedBounds({ latitude: 9.2, longitude: 7.05 }, bounds)).toBe(false);
  });
});

describe('shouldRefetchMovingRoute', () => {
  const now = 1_000_000;
  const onRoute = east(north(150), 10);
  const offRoute = east(north(150), MOVING_ROUTE_POLICY.offRouteMeters + 30);

  it('trims instead of refetching while the vehicle follows the route', () => {
    expect(shouldRefetchMovingRoute({ vehicle: onRoute, polyline: ROAD, lastFetchAt: now - 20_000, now })).toBe(false);
  });

  it('refetches when the vehicle leaves the route', () => {
    expect(shouldRefetchMovingRoute({ vehicle: offRoute, polyline: ROAD, lastFetchAt: now - 20_000, now })).toBe(true);
  });

  it('refreshes an on-route ETA once the route is a minute old', () => {
    expect(shouldRefetchMovingRoute({ vehicle: onRoute, polyline: ROAD, lastFetchAt: now - MOVING_ROUTE_POLICY.maxAgeMs, now })).toBe(true);
  });

  it('never refetches more often than the minimum interval, even off route', () => {
    expect(shouldRefetchMovingRoute({ vehicle: offRoute, polyline: ROAD, lastFetchAt: now - 3_000, now })).toBe(false);
    expect(shouldRefetchMovingRoute({ vehicle: onRoute, polyline: [], lastFetchAt: now - 3_000, now })).toBe(false);
  });

  it('retries a missing route after the minimum interval', () => {
    expect(shouldRefetchMovingRoute({ vehicle: onRoute, polyline: [], lastFetchAt: now - MOVING_ROUTE_POLICY.minIntervalMs, now })).toBe(true);
  });

  // Before the fix, every 4-second position update refetched Directions:
  // 75 requests over the same five minutes.
  it('refreshes once a minute over five minutes of on-route driving', () => {
    let lastFetchAt = 0;
    let fetches = 0;
    for (let t = 4_000; t <= 300_000; t += 4_000) {
      if (shouldRefetchMovingRoute({ vehicle: onRoute, polyline: ROAD, lastFetchAt, now: t })) {
        fetches += 1;
        lastFetchAt = t;
      }
    }
    expect(fetches).toBe(5);
  });
});
