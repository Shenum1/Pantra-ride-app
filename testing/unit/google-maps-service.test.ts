import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GoogleMapsService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('builds a static map URL with center, marker, and key', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'unit-test-key';
    const { GoogleMapsService } = await import('@/lib/google-maps-service');

    const url = GoogleMapsService.buildStaticMapUrl({
      center: { latitude: 9.0765, longitude: 7.3986 },
      markers: [
        {
          location: { latitude: 9.08, longitude: 7.4 },
          type: 'pickup',
        },
      ],
      width: 500,
      height: 400,
    });

    expect(url).toContain('maps.googleapis.com/maps/api/staticmap');
    expect(url).toContain('center=9.0765,7.3986');
    expect(url).toContain('size=500x400');
    expect(url).toContain('markers=color:blue|label:P|9.08,7.4');
    expect(url).toContain('key=unit-test-key');
  });

  it('falls back to mock places when Google place search fails', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'unit-test-key';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const { GoogleMapsService } = await import('@/lib/google-maps-service');

    const places = await GoogleMapsService.searchPlaces('Kubwa');

    expect(places.length).toBeGreaterThan(0);
    expect(places[0].name).toContain('Kubwa');
  });

  it('returns estimated directions when Google directions fails', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'unit-test-key';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const { GoogleMapsService } = await import('@/lib/google-maps-service');

    const directions = await GoogleMapsService.getDirections(
      { latitude: 9.0765, longitude: 7.3986 },
      { latitude: 9.1538, longitude: 7.322 },
    );

    expect(directions).not.toBeNull();
    expect(directions?.distance).toBeGreaterThan(0);
    expect(directions?.coordinates).toHaveLength(2);
  });

  it('diagnoses rejected Google APIs even when JSON endpoints return HTTP 200', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'unit-test-key';
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'REQUEST_DENIED', error_message: 'API key invalid' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'REQUEST_DENIED', error_message: 'API key invalid' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'REQUEST_DENIED', error_message: 'API key invalid' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response('Forbidden', { status: 403 })));
    const { GoogleMapsService } = await import('@/lib/google-maps-service');

    const diagnostic = await GoogleMapsService.testApiKey();

    expect(diagnostic.success).toBe(false);
    expect(diagnostic.apis).toEqual({
      places: false,
      autocomplete: false,
      directions: false,
      staticMap: false,
    });
    expect(diagnostic.message).toContain('key is present');
  });

  it('passes diagnostics when required Google APIs and static map respond correctly', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'unit-test-key';
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'OK', results: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'OK', predictions: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'OK', routes: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response('image-bytes', {
        status: 200,
        headers: { 'content-type': 'image/png' },
      })));
    const { GoogleMapsService } = await import('@/lib/google-maps-service');

    const diagnostic = await GoogleMapsService.testApiKey();

    expect(diagnostic.success).toBe(true);
    expect(diagnostic.apis.staticMap).toBe(true);
  });
});
