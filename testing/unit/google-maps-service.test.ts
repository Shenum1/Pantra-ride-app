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
    expect(url).toContain('markers=color:0x0066FF|label:P|9.08,7.4');
    expect(url).toContain('key=unit-test-key');
  });

  it('returns no results when Google place search fails, instead of fake places', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'unit-test-key';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const { GoogleMapsService } = await import('@/lib/google-maps-service');

    const places = await GoogleMapsService.searchPlaces('Kubwa');

    expect(places).toEqual([]);
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
    expect(directions?.isEstimate).toBe(true);
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

  function jsonResponse(body: unknown) {
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  }

  it('autocompletes with one request per keystroke, carrying the session token and origin', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'unit-test-key';
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      status: 'OK',
      predictions: [
        {
          place_id: 'banex',
          description: 'Banex Plaza, Wuse 2, Abuja, Nigeria',
          structured_formatting: { main_text: 'Banex Plaza', secondary_text: 'Wuse 2, Abuja, Nigeria' },
          types: ['shopping_mall', 'establishment'],
          distance_meters: 2380,
        },
        {
          place_id: 'garki-hospital',
          description: 'Garki Hospital, Garki, Abuja, Nigeria',
          structured_formatting: { main_text: 'Garki Hospital', secondary_text: 'Garki, Abuja, Nigeria' },
          types: ['hospital'],
          distance_meters: 6100,
        },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { GoogleMapsService } = await import('@/lib/google-maps-service');

    const results = await GoogleMapsService.autocomplete('Ban', { latitude: 9.06, longitude: 7.47 }, 'session-123');

    // Previously: 1 autocomplete + up to 8 Place Details calls per keystroke.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/place/autocomplete/json');
    expect(url).toContain('sessiontoken=session-123');
    expect(url).toContain('origin=9.06,7.47');
    expect(url).toContain('components=country:ng');
    expect(results).toEqual([
      expect.objectContaining({ placeId: 'banex', name: 'Banex Plaza', address: 'Wuse 2, Abuja', distanceMeters: 2380, types: ['shopping_mall', 'establishment'] }),
      expect.objectContaining({ placeId: 'garki-hospital', name: 'Garki Hospital', address: 'Garki, Abuja', distanceMeters: 6100 }),
    ]);
    expect(results[0].location).toBeUndefined();
  });

  it('omits origin when the rider location is unknown, so no misleading distances', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'unit-test-key';
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      status: 'OK',
      predictions: [{ place_id: 'p1', description: 'Kubwa, Abuja', structured_formatting: { main_text: 'Kubwa', secondary_text: 'Abuja' } }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { GoogleMapsService } = await import('@/lib/google-maps-service');

    const results = await GoogleMapsService.autocomplete('Kubwa');

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).not.toContain('origin=');
    expect(url).not.toContain('sessiontoken=');
    expect(results[0].distanceMeters).toBeUndefined();
  });

  it('falls back to text search rows, which carry coordinates and distance', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'unit-test-key';
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: 'ZERO_RESULTS', predictions: [] }))
      .mockResolvedValueOnce(jsonResponse({
        status: 'OK',
        results: [{ place_id: 'jabi', name: 'Jabi Lake Mall', formatted_address: 'Bala Sokoto Way, Jabi, Abuja, Nigeria', geometry: { location: { lat: 9.07, lng: 7.42 } } }],
      })));
    const { GoogleMapsService } = await import('@/lib/google-maps-service');

    const results = await GoogleMapsService.autocomplete('Jabi Lake', { latitude: 9.06, longitude: 7.47 }, 'session-123');

    expect(results).toHaveLength(1);
    expect(results[0].location).toMatchObject({ latitude: 9.07, longitude: 7.42 });
    expect(results[0].distanceMeters).toBeGreaterThan(5000);
  });

  it('closes the Places session with the same token on Place Details', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'unit-test-key';
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      status: 'OK',
      result: { place_id: 'banex', name: 'Banex Plaza', formatted_address: 'Aminu Kano Cres, Wuse 2, Abuja, Nigeria', geometry: { location: { lat: 9.0788, lng: 7.4702 } } },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { GoogleMapsService } = await import('@/lib/google-maps-service');

    const place = await GoogleMapsService.getPlaceDetails('banex', 'session-123');

    expect(String(fetchMock.mock.calls[0][0])).toContain('sessiontoken=session-123');
    expect(place?.location).toMatchObject({ latitude: 9.0788, longitude: 7.4702 });
  });

  it('keeps the place name in the stored pickup/dropoff label', async () => {
    const { formatPlaceLabel } = await import('@/lib/google-maps-service');

    expect(formatPlaceLabel('Banex Plaza', 'Wuse 2, Abuja')).toBe('Banex Plaza, Wuse 2, Abuja');
    expect(formatPlaceLabel('Ahmadu Bello Way', 'Abuja')).toBe('Ahmadu Bello Way, Abuja');
    // Text Search addresses often already start with the name.
    expect(formatPlaceLabel('Kubwa', 'Kubwa, Abuja')).toBe('Kubwa, Abuja');
    expect(formatPlaceLabel('', 'Garki, Abuja')).toBe('Garki, Abuja');
    expect(formatPlaceLabel('Jabi Lake Mall', '')).toBe('Jabi Lake Mall');
  });
});
