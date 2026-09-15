import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getServerDirections, DirectionsUnavailableError, FARE_SOURCE } from '@/backend/lib/directions-service';

const ORIGIN = { latitude: 9.0820, longitude: 7.4951 };
const DESTINATION = { latitude: 9.0579, longitude: 7.4951 };

function mockDirectionsResponse(distanceMeters: number, durationSeconds: number) {
  return {
    ok: true,
    json: async () => ({
      status: 'OK',
      routes: [{ legs: [{ distance: { value: distanceMeters }, duration: { value: durationSeconds } }] }],
    }),
  } as Response;
}

describe('getServerDirections', () => {
  const originalKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-key';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = originalKey;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // Test A — Google Directions succeeds.
  it('returns fareSource="google_directions" and the real road distance/duration on success', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockDirectionsResponse(12345, 900));

    const result = await getServerDirections(ORIGIN, DESTINATION);

    expect(result.fareSource).toBe('google_directions');
    expect(result.fareSource).toBe(FARE_SOURCE);
    expect(result.distanceMeters).toBe(12345);
    expect(result.durationSeconds).toBe(900);
  });

  it('retries once before succeeding on a transient failure', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce(mockDirectionsResponse(5000, 400));
    global.fetch = fetchMock;

    const result = await getServerDirections(ORIGIN, DESTINATION, { retryDelayMs: 0 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.fareSource).toBe('google_directions');
    expect(result.distanceMeters).toBe(5000);
  });

  // Test B — Google Directions fails (Option A: no ride is ever backed by an estimate).
  it('throws DirectionsUnavailableError after exhausting retries, rather than falling back to an estimate', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(getServerDirections(ORIGIN, DESTINATION, { retries: 1, retryDelayMs: 0 })).rejects.toThrow(
      DirectionsUnavailableError
    );
  });

  it('throws DirectionsUnavailableError when Directions returns a non-OK/empty response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ZERO_RESULTS', routes: [] }) } as Response);

    await expect(getServerDirections(ORIGIN, DESTINATION, { retries: 0 })).rejects.toThrow(DirectionsUnavailableError);
  });

  it('throws DirectionsUnavailableError immediately when no API key is configured (no fallback, no wasted retries)', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = '';
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    await expect(getServerDirections(ORIGIN, DESTINATION)).rejects.toThrow(DirectionsUnavailableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never returns a result without an explicit fareSource — there is no code path back to a silent estimate', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockDirectionsResponse(1000, 100));
    const result = await getServerDirections(ORIGIN, DESTINATION);
    expect(result).toHaveProperty('fareSource', 'google_directions');
  });
});
