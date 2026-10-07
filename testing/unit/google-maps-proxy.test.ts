import { describe, expect, it, vi } from 'vitest';
import { handleGoogleMapsProxy, isAllowedGoogleMapsPath } from '@/backend/lib/google-maps-proxy';

const fakeAdmin: any = {
  auth: {
    getUser: vi.fn(async (token: string) =>
      token === 'valid-token' ? { data: { user: { id: 'u1' } }, error: null } : { data: { user: null }, error: { message: 'bad' } }
    ),
  },
};

function req(path: string | null, auth?: string, extra = '') {
  const url = new URL('http://localhost/api/google-maps');
  if (path !== null) url.searchParams.set('path', path);
  const headers = new Headers();
  if (auth) headers.set('authorization', auth);
  return new Request(url.toString() + extra, { headers });
}

function okFetch() {
  return vi.fn(async () => new Response(JSON.stringify({ status: 'OK' }), { headers: { 'content-type': 'application/json' } }));
}

describe('/api/google-maps proxy', () => {
  it('rejects a request with no session token, without calling Google', async () => {
    const fetchImpl = okFetch();
    const res = await handleGoogleMapsProxy(req('/maps/api/geocode/json'), { supabaseAdmin: fakeAdmin, apiKey: 'k', fetchImpl });
    expect(res.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects an invalid session token', async () => {
    const fetchImpl = okFetch();
    const res = await handleGoogleMapsProxy(req('/maps/api/geocode/json', 'Bearer forged'), { supabaseAdmin: fakeAdmin, apiKey: 'k', fetchImpl });
    expect(res.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails closed when the server has no Supabase admin client', async () => {
    const fetchImpl = okFetch();
    const res = await handleGoogleMapsProxy(req('/maps/api/geocode/json', 'Bearer valid-token'), { supabaseAdmin: null, apiKey: 'k', fetchImpl });
    expect(res.status).toBe(500);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    '/maps/api/distancematrix/json',
    '/maps/api/elevation/json',
    '/maps/api/timezone/json',
    '/maps/api/place/autocomplete/json/../../elevation/json',
    '/maps/api/place/',
  ])('refuses endpoint %s that the app does not use', async (path) => {
    const fetchImpl = okFetch();
    const res = await handleGoogleMapsProxy(req(path, 'Bearer valid-token'), { supabaseAdmin: fakeAdmin, apiKey: 'k', fetchImpl });
    expect(res.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('allowlists exactly the endpoints lib/google-maps-service.ts calls', () => {
    for (const p of [
      '/maps/api/place/autocomplete/json',
      '/maps/api/place/details/json',
      '/maps/api/place/textsearch/json',
      '/maps/api/place/nearbysearch/json',
      '/maps/api/place/photo',
      '/maps/api/directions/json',
      '/maps/api/geocode/json',
    ]) {
      expect(isAllowedGoogleMapsPath(p), p).toBe(true);
    }
  });

  it('forwards an allowed, authenticated request with the server key (client key param ignored)', async () => {
    const fetchImpl = okFetch();
    const res = await handleGoogleMapsProxy(
      req('/maps/api/geocode/json', 'Bearer valid-token', '&latlng=9.07,7.39&key=attacker-key'),
      { supabaseAdmin: fakeAdmin, apiKey: 'server-key', fetchImpl }
    );
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const calledUrl = new URL(String((fetchImpl.mock.calls[0] as any[])[0]));
    expect(calledUrl.origin).toBe('https://maps.googleapis.com');
    expect(calledUrl.pathname).toBe('/maps/api/geocode/json');
    expect(calledUrl.searchParams.get('latlng')).toBe('9.07,7.39');
    expect(calledUrl.searchParams.get('key')).toBe('server-key');
    expect(calledUrl.searchParams.has('path')).toBe(false);
  });
});

describe('GoogleMapsService on web', () => {
  it('sends the Supabase session as a Bearer token to the proxy', async () => {
    vi.resetModules();
    vi.doMock('react-native', () => ({ Platform: { OS: 'web' } }));
    vi.doMock('@/lib/supabase', () => ({
      supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'sess-123' } } }) } },
    }));
    vi.stubGlobal('window', { location: { origin: 'http://localhost:8081' } });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: 'ZERO_RESULTS', predictions: [] })));
    vi.stubGlobal('fetch', fetchMock);
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'unit-test-key';

    try {
      const { GoogleMapsService } = await import('@/lib/google-maps-service');
      await GoogleMapsService.autocomplete('Kubwa');

      expect(fetchMock).toHaveBeenCalled();
      const [url, init] = fetchMock.mock.calls[0] as any[];
      const proxied = new URL(String(url));
      expect(proxied.pathname).toBe('/api/google-maps');
      expect(proxied.searchParams.get('path')).toBe('/maps/api/place/autocomplete/json');
      expect(proxied.searchParams.has('key')).toBe(false);
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer sess-123');
    } finally {
      vi.unstubAllGlobals();
      vi.doUnmock('react-native');
      vi.doUnmock('@/lib/supabase');
      vi.resetModules();
    }
  });
});
