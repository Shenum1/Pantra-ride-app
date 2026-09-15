// Server-side distance/duration resolution for rides.create
// (backend/trpc/routes/rides/create/route.ts) — the ONLY source of distance
// for an authoritative, financially-settled ride.
//
// Pre-Phase-1.1 this silently fell back to a Haversine (straight-line)
// estimate whenever Google Directions was unreachable, which could produce a
// materially different (typically lower) fare than the real road distance
// with zero trace in the data. That fallback has been removed from this
// authoritative path entirely — see FARE_SOURCE below. There's still a
// separate Haversine estimate in lib/google-maps-service.ts, but that one
// feeds only the PRE-REQUEST client-side estimate (never persisted as the
// final fare) and is intentionally untouched.
//
// No new secret is needed: backend/hono.ts's existing /google-maps proxy
// already reads process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY server-side —
// the EXPO_PUBLIC_ prefix only controls whether Expo bundles a var into the
// CLIENT build, it has no effect on Node's own process.env access.
// Read lazily (not as a module-level constant) so tests can set/unset it
// per-case without needing to control import order.
function getGoogleMapsApiKey(): string {
  return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
}

// The only fare source that can ever produce an authoritative, financially
// settled ride today. Recorded on every ride via rides.fareSource (see
// supabase-schema-fare-source.sql) so a future change to this policy — or a
// bug that reintroduces a fallback — is immediately auditable rather than
// silent. Currently a single-value union by design (Option A: no fallback
// is treated as authoritative); a future source (e.g. a different routing
// provider) would extend this type deliberately, not implicitly.
export const FARE_SOURCE = 'google_directions' as const;

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface ServerDirectionsResult {
  distanceMeters: number;
  durationSeconds: number;
  fareSource: typeof FARE_SOURCE;
}

// Thrown when road distance cannot be established. rides.create lets this
// propagate as a plain error — the ride is never created, matching every
// other "expected, retryable failure" in this route (e.g. its own insert
// error) — rather than silently substituting an estimate for money purposes.
// Both existing call sites (app/ride-confirmation.tsx, app/ride-checkout.tsx)
// already wrap requestRide() in try/catch and show a "please try again"
// alert, so this surfaces correctly with no client-side changes needed.
export class DirectionsUnavailableError extends Error {
  constructor(message = 'Unable to calculate the route for this trip right now. Please try again.') {
    super(message);
    this.name = 'DirectionsUnavailableError';
  }
}

interface DirectionsCallResult {
  distanceMeters: number;
  durationSeconds: number;
}

async function callDirectionsOnce(origin: LatLng, destination: LatLng, apiKey: string): Promise<DirectionsCallResult | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&region=ng&key=${apiKey}`;
    const response = await fetch(url);
    const data = (await response.json()) as {
      status?: string;
      routes?: Array<{ legs?: Array<{ distance?: { value?: number }; duration?: { value?: number } }> }>;
    };

    const route = Array.isArray(data?.routes) ? data.routes[0] : null;
    const leg = Array.isArray(route?.legs) ? route!.legs![0] : null;
    if (!route || !leg || typeof leg.distance?.value !== 'number' || typeof leg.duration?.value !== 'number') {
      return null;
    }

    return { distanceMeters: leg.distance.value, durationSeconds: leg.duration.value };
  } catch (error) {
    console.error('Google Directions call failed:', error);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retries once (short backoff) before giving up — most real-world Directions
// failures are transient network blips, and a retry meaningfully reduces how
// often a rider sees "please try again" for a request that would have
// succeeded a second later. `retries`/`retryDelayMs` are overridable so
// tests don't have to sit through the real backoff.
export async function getServerDirections(
  origin: LatLng,
  destination: LatLng,
  options?: { retries?: number; retryDelayMs?: number }
): Promise<ServerDirectionsResult> {
  const retries = options?.retries ?? 1;
  const retryDelayMs = options?.retryDelayMs ?? 300;
  const apiKey = getGoogleMapsApiKey();

  if (!apiKey) {
    throw new DirectionsUnavailableError('Route calculation is not configured on the server.');
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await callDirectionsOnce(origin, destination, apiKey);
    if (result) {
      return { ...result, fareSource: FARE_SOURCE };
    }
    if (attempt < retries) {
      await sleep(retryDelayMs);
    }
  }

  throw new DirectionsUnavailableError();
}
