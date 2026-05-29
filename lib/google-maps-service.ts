import { Location } from '@/types';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const NIGERIA_BOUNDS = {
  minLongitude: 2.6684,
  minLatitude: 4.2406,
  maxLongitude: 14.678,
  maxLatitude: 13.892,
};

interface GooglePrediction {
  place_id: string;
  description: string;
  structured_formatting?: { main_text?: string; secondary_text?: string };
}

interface GoogleApiResponse<T> {
  status?: string;
  error_message?: string;
  predictions?: GooglePrediction[];
  results?: T[];
  result?: T;
  routes?: any[];
}

interface GooglePlaceResult {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
}

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  location: Location;
}

export interface DirectionsResult {
  distance: number;
  duration: number;
  coordinates: { latitude: number; longitude: number }[];
  polyline: string;
}

export interface AutocompleteResult {
  id: string;
  description: string;
  placeId: string;
  location: Location;
  name: string;
  address: string;
}

interface DiagnosticResult {
  success: boolean;
  message: string;
  apis: { places: boolean; autocomplete: boolean; directions: boolean; staticMap: boolean };
}

function normalizeLocation(latitude: number, longitude: number): Location {
  return { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
}

function isInNigeria(location: Location): boolean {
  return location.latitude >= NIGERIA_BOUNDS.minLatitude
    && location.latitude <= NIGERIA_BOUNDS.maxLatitude
    && location.longitude >= NIGERIA_BOUNDS.minLongitude
    && location.longitude <= NIGERIA_BOUNDS.maxLongitude;
}

function buildNigeriaQuery(query: string): string {
  const trimmed = query.trim();
  return trimmed.toLowerCase().includes('nigeria') ? trimmed : `${trimmed}, Nigeria`;
}

function dedupeByAddress<T extends { name: string; address: string }>(results: T[]): T[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.name.toLowerCase()}::${result.address.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeGooglePlace(place: GooglePlaceResult, index: number): PlaceResult | null {
  const lat = place.geometry?.location?.lat;
  const lng = place.geometry?.location?.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  const location = normalizeLocation(lat, lng);
  if (!isInNigeria(location)) return null;

  return {
    id: place.place_id ?? `google-place-${index}`,
    name: place.name?.trim() || place.formatted_address?.split(',')[0]?.trim() || 'Unknown place',
    address: place.formatted_address?.trim() || 'Nigeria',
    location,
  };
}

function encodeStaticMarkers(markers: Array<{ location: Location; color: string; label?: string }>): string {
  return markers
    .map((marker) => `&markers=color:${marker.color}${marker.label ? `|label:${marker.label}` : ''}|${marker.location.latitude},${marker.location.longitude}`)
    .join('');
}

async function isGoogleJsonApiOk(response: Response): Promise<boolean> {
  if (!response.ok) return false;

  try {
    const data = await response.json() as GoogleApiResponse<unknown>;
    return data.status === 'OK' || data.status === 'ZERO_RESULTS';
  } catch {
    return false;
  }
}

function isStaticMapResponseOk(response: Response): boolean {
  const contentType = response.headers.get('content-type') ?? '';
  return response.ok && contentType.toLowerCase().startsWith('image/');
}

export class GoogleMapsService {
  static get apiKey(): string {
    return GOOGLE_MAPS_API_KEY;
  }

  static get hasApiKey(): boolean {
    return GOOGLE_MAPS_API_KEY.length > 0;
  }

  static buildStaticMapUrl(params: {
    center: Location;
    routePolyline?: string;
    markers?: Array<{ location: Location; type?: 'driver' | 'pickup' | 'dropoff' }>;
    width?: number;
    height?: number;
    zoom?: number;
  }): string | null {
    if (!GOOGLE_MAPS_API_KEY) return null;

    const width = Math.min(params.width ?? 900, 1200);
    const height = Math.min(params.height ?? 900, 1200);
    const markerParams = encodeStaticMarkers((params.markers ?? []).map((marker) => ({
      location: marker.location,
      color: marker.type === 'dropoff' ? 'red' : marker.type === 'driver' ? 'black' : 'blue',
      label: marker.type === 'dropoff' ? 'D' : marker.type === 'pickup' ? 'P' : undefined,
    })));
    const path = params.routePolyline ? `&path=enc:${encodeURIComponent(params.routePolyline)}` : '';

    return `https://maps.googleapis.com/maps/api/staticmap?center=${params.center.latitude},${params.center.longitude}&zoom=${params.zoom ?? 14}&size=${width}x${height}&scale=2&maptype=roadmap${markerParams}${path}&key=${GOOGLE_MAPS_API_KEY}`;
  }

  static async testApiKey(): Promise<DiagnosticResult> {
    const apis = { places: false, autocomplete: false, directions: false, staticMap: false };
    if (!GOOGLE_MAPS_API_KEY) {
      return { success: false, message: 'Google Maps API key is missing.', apis };
    }

    try {
      const [places, autocomplete, directions, staticMap] = await Promise.all([
        fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent('Shoprite Abuja Nigeria')}&key=${GOOGLE_MAPS_API_KEY}`),
        fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent('Kubwa')}&components=country:ng&key=${GOOGLE_MAPS_API_KEY}`),
        fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=9.0820,7.4951&destination=9.0579,7.4951&key=${GOOGLE_MAPS_API_KEY}`),
        fetch(`https://maps.googleapis.com/maps/api/staticmap?center=9.0765,7.3986&zoom=14&size=300x200&key=${GOOGLE_MAPS_API_KEY}`),
      ]);

      apis.places = await isGoogleJsonApiOk(places);
      apis.autocomplete = await isGoogleJsonApiOk(autocomplete);
      apis.directions = await isGoogleJsonApiOk(directions);
      apis.staticMap = isStaticMapResponseOk(staticMap);

      const success = apis.places && apis.autocomplete && apis.directions && apis.staticMap;
      return {
        success,
        message: success
          ? 'Google Maps services are reachable.'
          : 'Google Maps key is present, but one or more required APIs rejected the request. Check enabled APIs, billing, and key restrictions.',
        apis,
      };
    } catch (error) {
      console.error('Google Maps diagnostic error:', error);
      return { success: false, message: 'Failed to test Google Maps services.', apis };
    }
  }

  static async autocomplete(input: string, location?: Location): Promise<AutocompleteResult[]> {
    const query = input.trim();
    if (query.length < 2) return [];
    if (!GOOGLE_MAPS_API_KEY) return this.getMockPlaces(query).map(this.placeToAutocomplete);

    try {
      const loc = location ? `&location=${location.latitude},${location.longitude}&radius=100000&strictbounds=false` : '&location=9.0765,7.3986&radius=900000&strictbounds=false';
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:ng&language=en${loc}&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json() as GoogleApiResponse<GooglePlaceResult>;
      if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.warn('Google autocomplete returned non-OK status:', data.status, data.error_message ?? 'No message');
      }
      const predictions: GooglePrediction[] = Array.isArray(data?.predictions) ? data.predictions : [];
      const details = await Promise.all(predictions.slice(0, 8).map(async (prediction) => {
        const place = await this.getPlaceDetails(prediction.place_id);
        if (!place) return null;
        return {
          id: prediction.place_id,
          description: prediction.description,
          placeId: prediction.place_id,
          location: place.location,
          name: prediction.structured_formatting?.main_text ?? place.name,
          address: prediction.structured_formatting?.secondary_text ?? place.address,
        };
      }));
      const results = details.filter((item): item is AutocompleteResult => item !== null);
      return results.length > 0 ? dedupeByAddress(results) : this.searchPlaces(query, location).then((places) => places.map(this.placeToAutocomplete));
    } catch (error) {
      console.error('Google autocomplete error:', error);
      return this.getMockPlaces(query).map(this.placeToAutocomplete);
    }
  }

  static async searchPlaces(query: string, location?: Location): Promise<PlaceResult[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    if (!GOOGLE_MAPS_API_KEY) return this.getMockPlaces(trimmed);

    try {
      const loc = location ? `&location=${location.latitude},${location.longitude}&radius=100000` : '';
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(buildNigeriaQuery(trimmed))}${loc}&region=ng&language=en&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json() as GoogleApiResponse<GooglePlaceResult>;
      if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.warn('Google place search returned non-OK status:', data.status, data.error_message ?? 'No message');
      }
      const places: GooglePlaceResult[] = Array.isArray(data?.results) ? data.results : [];
      const normalized = places.map(normalizeGooglePlace).filter((item): item is PlaceResult => item !== null);
      return normalized.length > 0 ? dedupeByAddress(normalized).slice(0, 12) : this.getMockPlaces(trimmed);
    } catch (error) {
      console.error('Google place search error:', error);
      return this.getMockPlaces(trimmed);
    }
  }

  static async getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
    if (!GOOGLE_MAPS_API_KEY) return this.getMockPlaces(placeId)[0] ?? null;

    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=place_id,name,formatted_address,geometry&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json() as GoogleApiResponse<GooglePlaceResult>;
      if (data.status && data.status !== 'OK') {
        console.warn('Google place details returned non-OK status:', data.status, data.error_message ?? 'No message');
        return null;
      }
      return data.result ? normalizeGooglePlace(data.result, 0) : null;
    } catch (error) {
      console.error('Google place details error:', error);
      return null;
    }
  }

  static async getDirections(origin: Location, destination: Location): Promise<DirectionsResult | null> {
    if (!GOOGLE_MAPS_API_KEY) return this.getEstimatedDirections(origin, destination);

    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&region=ng&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json() as GoogleApiResponse<GooglePlaceResult>;
      if (data.status && data.status !== 'OK') {
        console.warn('Google directions returned non-OK status:', data.status, data.error_message ?? 'No message');
      }
      const route = Array.isArray(data?.routes) ? data.routes[0] : null;
      const leg = Array.isArray(route?.legs) ? route.legs[0] : null;
      if (!route || !leg) return this.getEstimatedDirections(origin, destination);
      const polyline = route.overview_polyline?.points ?? '';
      return {
        distance: typeof leg.distance?.value === 'number' ? leg.distance.value : 0,
        duration: typeof leg.duration?.value === 'number' ? leg.duration.value : 0,
        coordinates: this.decodePolyline(polyline),
        polyline,
      };
    } catch (error) {
      console.error('Google directions error:', error);
      return this.getEstimatedDirections(origin, destination);
    }
  }

  static async reverseGeocode(location: Location): Promise<string> {
    if (!GOOGLE_MAPS_API_KEY) return 'Current location';
    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.latitude},${location.longitude}&region=ng&key=${GOOGLE_MAPS_API_KEY}`);
      const data = await response.json();
      return data?.results?.[0]?.formatted_address ?? 'Current location';
    } catch {
      return 'Current location';
    }
  }

  static getExternalDirectionsUrl(origin: Location, destination: Location): string {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
  }

  static getNearbyCategories(): Array<{ id: string; label: string; query: string }> {
    return [
      { id: 'restaurants-near-me', label: 'Restaurants near me', query: 'restaurants near me' },
      { id: 'hotels-near-me', label: 'Hotels near me', query: 'hotels near me' },
      { id: 'shops-near-me', label: 'Shops near me', query: 'shops near me' },
      { id: 'hospitals-near-me', label: 'Hospitals near me', query: 'hospitals near me' },
      { id: 'banks-near-me', label: 'Banks near me', query: 'banks near me' },
      { id: 'fuel-near-me', label: 'Fuel near me', query: 'fuel station near me' },
      { id: 'markets-near-me', label: 'Markets near me', query: 'market near me' },
      { id: 'schools-near-me', label: 'Schools near me', query: 'school near me' },
      { id: 'offices-near-me', label: 'Offices near me', query: 'office building near me' },
    ];
  }

  static getMockPlaces(query: string): PlaceResult[] {
    const lowerQuery = query.toLowerCase();
    const places: PlaceResult[] = [
      { id: 'mock-kubwa', name: 'Kubwa', address: 'Kubwa, Abuja, Nigeria', location: normalizeLocation(9.1538, 7.3220) },
      { id: 'mock-shoprite-jabi', name: 'Jabi Lake Mall Shoprite', address: 'Bala Sokoto Way, Jabi, Abuja, Nigeria', location: normalizeLocation(9.0835, 7.4514) },
      { id: 'mock-transcorp', name: 'Transcorp Hilton Abuja', address: '1 Aguiyi Ironsi Street, Maitama, Abuja, Nigeria', location: normalizeLocation(9.0762, 7.4967) },
      { id: 'mock-shoprite-ikeja', name: 'Shoprite Ikeja City Mall', address: 'Obafemi Awolowo Way, Ikeja, Lagos, Nigeria', location: normalizeLocation(6.6018, 3.3515) },
      { id: 'mock-eko', name: 'Eko Hotels & Suites', address: 'Victoria Island, Lagos, Nigeria', location: normalizeLocation(6.4308, 3.4219) },
      { id: 'mock-airport-abuja', name: 'Nnamdi Azikiwe International Airport', address: 'Airport Road, Abuja, Nigeria', location: normalizeLocation(9.0068, 7.2632) },
    ];
    const filtered = places.filter((place) => `${place.name} ${place.address}`.toLowerCase().includes(lowerQuery));
    return filtered.length > 0 ? filtered : places;
  }

  private static placeToAutocomplete(place: PlaceResult): AutocompleteResult {
    return { id: place.id, description: place.address, placeId: place.id, location: place.location, name: place.name, address: place.address };
  }

  private static getEstimatedDirections(origin: Location, destination: Location): DirectionsResult {
    const distance = this.calculateDistance(origin, destination);
    return { distance, duration: (distance / 1000 / 35) * 3600, coordinates: [origin, destination], polyline: '' };
  }

  private static calculateDistance(origin: Location, destination: Location): number {
    const radius = 6371000;
    const dLat = (destination.latitude - origin.latitude) * Math.PI / 180;
    const dLon = (destination.longitude - origin.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(origin.latitude * Math.PI / 180) * Math.cos(destination.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private static decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
    if (!encoded) return [];
    const coordinates: { latitude: number; longitude: number }[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    while (index < encoded.length) {
      let b = 0;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      lat += (result & 1) ? ~(result >> 1) : (result >> 1);
      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      lng += (result & 1) ? ~(result >> 1) : (result >> 1);
      coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return coordinates;
  }
}
