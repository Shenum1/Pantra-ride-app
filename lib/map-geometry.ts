// Pure geometry helpers for the live-trip map (components/Map.tsx): distances,
// vehicle bearing, route trimming and the camera/route refresh decisions.
// Kept free of React Native imports so they can be unit-tested directly.

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface LatLngBounds {
  northEast: LatLng;
  southWest: LatLng;
}

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceMeters(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Initial compass bearing from `from` to `to`, 0–360 with 0 = north.
export function bearingDegrees(from: LatLng, to: LatLng): number {
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const y = Math.sin(dLng) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Point-to-segment distance on a local flat projection — accurate to well
// under a metre over the few hundred metres a route segment spans.
function distanceToSegmentMeters(point: LatLng, start: LatLng, end: LatLng): number {
  const scaleX = Math.cos(toRadians(point.latitude)) * EARTH_RADIUS_METERS;
  const project = (p: LatLng) => ({ x: toRadians(p.longitude) * scaleX, y: toRadians(p.latitude) * EARTH_RADIUS_METERS });
  const p = project(point);
  const a = project(start);
  const b = project(end);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// Index of the polyline segment (its start vertex) closest to `point`.
// Returns -1 for an empty polyline.
export function nearestPolylineIndex(point: LatLng, polyline: LatLng[]): number {
  if (polyline.length === 0) return -1;
  if (polyline.length === 1) return 0;

  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const distance = distanceToSegmentMeters(point, polyline[i], polyline[i + 1]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return bestIndex;
}

export function distanceToPolylineMeters(point: LatLng, polyline: LatLng[]): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) return distanceMeters(point, polyline[0]);
  const index = nearestPolylineIndex(point, polyline);
  return distanceToSegmentMeters(point, polyline[index], polyline[index + 1]);
}

// Drops the part of the route the vehicle has already driven: the result
// starts at the vehicle and continues from the next vertex ahead of it.
export function trimPolylineFrom(point: LatLng, polyline: LatLng[]): LatLng[] {
  if (polyline.length < 2) return polyline;
  const index = nearestPolylineIndex(point, polyline);
  return [{ latitude: point.latitude, longitude: point.longitude }, ...polyline.slice(index + 1)];
}

// True when `point` is inside the visible bounds after shrinking every edge
// by `paddingRatio` of the span — i.e. comfortably on screen, not at the edge.
export function isInsidePaddedBounds(point: LatLng, bounds: LatLngBounds, paddingRatio = 0.15): boolean {
  const latPad = (bounds.northEast.latitude - bounds.southWest.latitude) * paddingRatio;
  const lngPad = (bounds.northEast.longitude - bounds.southWest.longitude) * paddingRatio;
  return (
    point.latitude <= bounds.northEast.latitude - latPad &&
    point.latitude >= bounds.southWest.latitude + latPad &&
    point.longitude <= bounds.northEast.longitude - lngPad &&
    point.longitude >= bounds.southWest.longitude + lngPad
  );
}

export const MOVING_ROUTE_POLICY = {
  // Further than this from the drawn route means the vehicle took another road.
  offRouteMeters: 50,
  // Refresh even when on route, so the ETA picks up traffic changes.
  maxAgeMs: 60_000,
  // Never refetch more often than this, whatever GPS noise says.
  minIntervalMs: 10_000,
} as const;

// Whether a route that starts at a moving vehicle needs fresh Directions.
// Between refetches the existing route is trimmed locally instead.
export function shouldRefetchMovingRoute(params: {
  vehicle: LatLng;
  polyline: LatLng[];
  lastFetchAt: number;
  now: number;
  policy?: { offRouteMeters: number; maxAgeMs: number; minIntervalMs: number };
}): boolean {
  const { vehicle, polyline, lastFetchAt, now, policy = MOVING_ROUTE_POLICY } = params;
  const age = now - lastFetchAt;

  if (polyline.length < 2) return age >= policy.minIntervalMs;
  if (age < policy.minIntervalMs) return false;
  if (age >= policy.maxAgeMs) return true;
  return distanceToPolylineMeters(vehicle, polyline) > policy.offRouteMeters;
}
