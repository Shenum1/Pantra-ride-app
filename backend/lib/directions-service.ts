// Server-side distance/duration resolution for rides.create
// (backend/trpc/routes/rides/create/route.ts). Mirrors
// lib/google-maps-service.ts's getDirections/getEstimatedDirections exactly
// (same Directions endpoint, same haversine + 35km/h fallback math), just
// executed on the backend instead of the client — so the fare-defining
// distance/duration can no longer simply be whatever a client claims.
//
// No new secret is needed: backend/hono.ts's existing /google-maps proxy
// already reads process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY server-side —
// the EXPO_PUBLIC_ prefix only controls whether Expo bundles a var into the
// CLIENT build, it has no effect on Node's own process.env access.
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface ServerDirectionsResult {
  distanceMeters: number;
  durationSeconds: number;
  // true when Directions was unreachable/unconfigured and this fell back to
  // a haversine straight-line + assumed-speed estimate — callers should
  // treat this as a lower-confidence number, same as the client's own
  // DirectionsResult.isEstimate flag.
  isEstimate: boolean;
}

function haversineMeters(origin: LatLng, destination: LatLng): number {
  const radius = 6371000;
  const dLat = ((destination.latitude - origin.latitude) * Math.PI) / 180;
  const dLon = ((destination.longitude - origin.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((origin.latitude * Math.PI) / 180) *
      Math.cos((destination.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimatedDirections(origin: LatLng, destination: LatLng): ServerDirectionsResult {
  const distanceMeters = haversineMeters(origin, destination);
  return {
    distanceMeters,
    durationSeconds: (distanceMeters / 1000 / 35) * 3600,
    isEstimate: true,
  };
}

export async function getServerDirections(origin: LatLng, destination: LatLng): Promise<ServerDirectionsResult> {
  if (!GOOGLE_MAPS_API_KEY) {
    return estimatedDirections(origin, destination);
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&region=ng&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = (await response.json()) as { status?: string; routes?: Array<{ legs?: Array<{ distance?: { value?: number }; duration?: { value?: number } }> }> };

    const route = Array.isArray(data?.routes) ? data.routes[0] : null;
    const leg = Array.isArray(route?.legs) ? route!.legs![0] : null;
    if (!route || !leg || typeof leg.distance?.value !== 'number' || typeof leg.duration?.value !== 'number') {
      return estimatedDirections(origin, destination);
    }

    return { distanceMeters: leg.distance.value, durationSeconds: leg.duration.value, isEstimate: false };
  } catch (error) {
    console.error('Server-side Google Directions call failed, falling back to haversine estimate:', error);
    return estimatedDirections(origin, destination);
  }
}
