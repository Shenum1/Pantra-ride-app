import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE_ID } from '@/constants/mapbox';
import { Location } from '@/types';

interface MapboxFeature {
  id?: string;
  text?: string;
  place_name?: string;
  place_name_en?: string;
  center?: [number, number] | number[];
  properties?: {
    accuracy?: string;
    category?: string;
    maki?: string;
  };
  relevance?: number;
  place_type?: string[];
}

interface MapboxSearchboxSuggestion {
  mapbox_id?: string;
  name?: string;
  name_preferred?: string;
  full_address?: string;
  place_formatted?: string;
  feature_type?: string;
  poi_category?: string[];
  brand?: string[];
  context?: {
    country?: {
      country_code?: string;
      name?: string;
    };
    region?: {
      name?: string;
    };
    place?: {
      name?: string;
    };
    locality?: {
      name?: string;
    };
    neighborhood?: {
      name?: string;
    };
    postcode?: {
      name?: string;
    };
    address?: {
      name?: string;
      address_number?: string;
      street_name?: string;
    };
  };
}

interface MapboxSearchboxSuggestResponse {
  suggestions?: MapboxSearchboxSuggestion[];
}

interface MapboxSearchboxRetrieveFeature {
  properties?: {
    coordinates?: {
      latitude?: number;
      longitude?: number;
    };
    name?: string;
    name_preferred?: string;
    full_address?: string;
    place_formatted?: string;
    feature_type?: string;
    context?: MapboxSearchboxSuggestion['context'];
  };
}

interface MapboxSearchboxRetrieveResponse {
  features?: MapboxSearchboxRetrieveFeature[];
}

interface SearchCategory {
  id: string;
  label: string;
  terms: string[];
}

interface PlaceCatalogEntry {
  id: string;
  name: string;
  address: string;
  location: Location;
  tags: string[];
}

const NIGERIA_BOUNDS = {
  minLongitude: 2.6684,
  minLatitude: 4.2406,
  maxLongitude: 14.678,
  maxLatitude: 13.892,
};

const SEARCH_CATEGORIES: SearchCategory[] = [
  { id: 'restaurant', label: 'Restaurants', terms: ['restaurant', 'food', 'eatery', 'suya', 'pizza', 'shawarma'] },
  { id: 'hotel', label: 'Hotels', terms: ['hotel', 'resort', 'inn', 'lodge'] },
  { id: 'shop', label: 'Shops', terms: ['shop', 'mall', 'market', 'store', 'supermarket', 'shoprite'] },
  { id: 'hospital', label: 'Hospitals', terms: ['hospital', 'clinic', 'medical', 'pharmacy'] },
  { id: 'bank', label: 'Banks', terms: ['bank', 'atm', 'finance'] },
  { id: 'fuel', label: 'Fuel', terms: ['fuel', 'petrol', 'gas station', 'filling station'] },
  { id: 'airport', label: 'Airports', terms: ['airport', 'terminal', 'airfield'] },
];

function isWithinNigeriaBounds(latitude: number, longitude: number): boolean {
  return latitude >= NIGERIA_BOUNDS.minLatitude
    && latitude <= NIGERIA_BOUNDS.maxLatitude
    && longitude >= NIGERIA_BOUNDS.minLongitude
    && longitude <= NIGERIA_BOUNDS.maxLongitude;
}

function createSessionToken(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeCoordinateLocation(latitude: number, longitude: number): Location {
  return {
    latitude,
    longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };
}

function buildFallbackAutocomplete(place: PlaceResult): AutocompleteResult {
  return {
    id: place.id,
    description: `${place.name}, ${place.address}`,
    placeId: place.id,
    location: place.location,
    name: place.name,
    address: place.address,
  };
}

function normalizeQueryValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function extractSearchTerms(query: string): string[] {
  const normalized = normalizeQueryValue(query)
    .replace(/\bnear me\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(' ')
    .map((term) => term.trim())
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

function detectCategory(query: string): SearchCategory | null {
  const normalized = normalizeQueryValue(query);

  return SEARCH_CATEGORIES.find((category) => category.terms.some((term) => normalized.includes(term))) ?? null;
}

function buildCategoryBoost(query: string): string {
  const category = detectCategory(query);

  if (!category) {
    return '';
  }

  return ` ${category.label.toLowerCase()} ${category.terms.join(' ')}`;
}

function scoreCatalogEntry(entry: PlaceCatalogEntry, query: string): number {
  const normalizedQuery = normalizeQueryValue(query);
  const haystack = `${entry.name} ${entry.address} ${entry.tags.join(' ')}`.toLowerCase();
  const terms = extractSearchTerms(query);
  const hasNearMe = normalizedQuery.includes('near me');
  const exactName = entry.name.toLowerCase() === normalizedQuery;
  const startsWithName = entry.name.toLowerCase().startsWith(normalizedQuery);
  const includesFullQuery = haystack.includes(normalizedQuery);
  const tagMatches = terms.filter((term) => entry.tags.some((tag) => tag.includes(term))).length;
  const termMatches = terms.filter((term) => haystack.includes(term)).length;

  return (exactName ? 10 : 0)
    + (startsWithName ? 6 : 0)
    + (includesFullQuery ? 4 : 0)
    + termMatches * 1.8
    + tagMatches * 1.2
    + (hasNearMe ? 0.5 : 0);
}

function scoreFeature(feature: MapboxFeature, query?: string): number {
  const placeName = `${feature.place_name ?? ''} ${feature.place_name_en ?? ''} ${feature.text ?? ''}`.toLowerCase();
  const category = `${feature.properties?.category ?? ''} ${feature.properties?.maki ?? ''}`.toLowerCase();
  const placeTypes = feature.place_type ?? [];
  const relevance = typeof feature.relevance === 'number' ? feature.relevance : 0;
  const normalizedQuery = query?.trim().toLowerCase() ?? '';
  const startsWithQuery = normalizedQuery.length > 0 && (feature.text ?? '').toLowerCase().startsWith(normalizedQuery);
  const exactCategoryMatch = normalizedQuery.length > 2 && category.includes(normalizedQuery);
  const isNigeria = placeName.includes('nigeria');
  const isAddress = placeTypes.includes('address');
  const isPoi = placeTypes.includes('poi');
  const isPlace = placeTypes.includes('place') || placeTypes.includes('locality') || placeTypes.includes('neighborhood');

  return relevance
    + (isNigeria ? 3 : 0)
    + (isPoi ? 1.2 : 0)
    + (isAddress ? 0.6 : 0)
    + (isPlace ? 0.3 : 0)
    + (startsWithQuery ? 0.8 : 0)
    + (exactCategoryMatch ? 0.5 : 0);
}

function toFallbackAutocompleteResults(places: PlaceResult[]): AutocompleteResult[] {
  return places.map(buildFallbackAutocomplete);
}

function isNigeriaFeature(feature: MapboxFeature): boolean {
  const placeName = `${feature.place_name ?? ''} ${feature.place_name_en ?? ''} ${feature.text ?? ''}`.toLowerCase();
  return placeName.includes('nigeria');
}

function buildSearchboxAddress(suggestion: MapboxSearchboxSuggestion): string {
  const fullAddress = suggestion.full_address?.trim();
  if (fullAddress) {
    return fullAddress;
  }

  const placeFormatted = suggestion.place_formatted?.trim();
  const countryName = suggestion.context?.country?.name?.trim();
  const pieces = [placeFormatted, countryName].filter(Boolean);
  if (pieces.length > 0) {
    return pieces.join(', ');
  }

  return suggestion.name_preferred?.trim() ?? suggestion.name?.trim() ?? 'Unknown address';
}

function isNigeriaSearchboxSuggestion(suggestion: MapboxSearchboxSuggestion): boolean {
  const countryCode = suggestion.context?.country?.country_code?.toLowerCase();
  const countryName = suggestion.context?.country?.name?.toLowerCase();
  const address = buildSearchboxAddress(suggestion).toLowerCase();
  return countryCode === 'ng' || countryName === 'nigeria' || address.includes('nigeria');
}

function scoreSearchboxSuggestion(suggestion: MapboxSearchboxSuggestion, query: string): number {
  const normalizedQuery = normalizeQueryValue(query);
  const name = `${suggestion.name_preferred ?? ''} ${suggestion.name ?? ''}`.toLowerCase();
  const address = buildSearchboxAddress(suggestion).toLowerCase();
  const categories = `${suggestion.poi_category?.join(' ') ?? ''} ${suggestion.brand?.join(' ') ?? ''}`.toLowerCase();
  const isAddress = suggestion.feature_type === 'address' || suggestion.feature_type === 'street';
  const isPoi = suggestion.feature_type === 'poi';
  const startsWithName = normalizedQuery.length > 0 && name.startsWith(normalizedQuery);
  const includesName = normalizedQuery.length > 0 && name.includes(normalizedQuery);
  const includesAddress = normalizedQuery.length > 0 && address.includes(normalizedQuery);
  const includesCategory = normalizedQuery.length > 2 && categories.includes(normalizedQuery);
  const isNigeria = isNigeriaSearchboxSuggestion(suggestion);

  return (isNigeria ? 4 : 0)
    + (isPoi ? 1.8 : 0)
    + (isAddress ? 1 : 0)
    + (startsWithName ? 1.5 : 0)
    + (includesName ? 0.9 : 0)
    + (includesAddress ? 0.7 : 0)
    + (includesCategory ? 0.5 : 0);
}

function normalizeSearchboxSuggestion(
  suggestion: MapboxSearchboxSuggestion,
  location: Location,
  index: number,
): AutocompleteResult | null {
  if (!isNigeriaSearchboxSuggestion(suggestion)) {
    return null;
  }

  const mapboxId = suggestion.mapbox_id ?? `searchbox-${index}`;
  const name = suggestion.name_preferred?.trim() || suggestion.name?.trim() || buildSearchboxAddress(suggestion);
  const address = buildSearchboxAddress(suggestion);

  return {
    id: `searchbox:${mapboxId}`,
    description: address,
    placeId: `searchbox:${mapboxId}`,
    location,
    name,
    address,
  };
}

function normalizeFeature(feature: MapboxFeature, index: number): AutocompleteResult | null {
  if (!Array.isArray(feature?.center) || feature.center.length < 2) {
    return null;
  }

  if (!isNigeriaFeature(feature)) {
    return null;
  }

  const longitude = Number(feature.center[0]);
  const latitude = Number(feature.center[1]);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const id = feature.id || `mapbox-feature-${index}`;
  const name = feature.text || feature.place_name || 'Unknown place';
  const address = feature.place_name || feature.place_name_en || feature.text || 'Unknown address';

  return {
    id,
    description: address,
    placeId: id,
    location: {
      latitude,
      longitude,
    },
    name,
    address,
  };
}

function buildSearchQuery(input: string, location?: Location): string {
  const trimmedInput = input.trim();
  const defaultNigeriaProximity = '&proximity=3.3792,6.5244';
  const proximity = location
    ? `&proximity=${location.longitude},${location.latitude}`
    : defaultNigeriaProximity;
  const bbox = `&bbox=${NIGERIA_BOUNDS.minLongitude},${NIGERIA_BOUNDS.minLatitude},${NIGERIA_BOUNDS.maxLongitude},${NIGERIA_BOUNDS.maxLatitude}`;
  const country = '&country=ng';
  const fuzzyMatch = '&fuzzyMatch=true';
  const language = '&language=en';
  const routing = '&routing=true';
  const worldview = '&worldview=us';
  const limit = trimmedInput.length >= 4 ? 12 : 10;
  const category = detectCategory(trimmedInput);
  const types = category
    ? '&types=poi,address,place,locality,neighborhood,region'
    : trimmedInput.length <= 3
      ? '&types=place,locality,neighborhood,address,poi,region'
      : '&types=poi,address,place,locality,neighborhood,region';

  return `autocomplete=true&limit=${limit}${language}${types}${country}${bbox}${routing}${fuzzyMatch}${worldview}${proximity}`;
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
  apis: {
    geocoding: boolean;
    autocomplete: boolean;
    directions: boolean;
  };
}

function buildMapboxTileUrl(): string | null {
  if (!MAPBOX_ACCESS_TOKEN) {
    return null;
  }

  return `https://api.mapbox.com/styles/v1/mapbox/${MAPBOX_STYLE_ID}/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_ACCESS_TOKEN}`;
}

function dedupeAutocompleteResults(results: AutocompleteResult[]): AutocompleteResult[] {
  const seen = new Set<string>();

  return results.filter((result: AutocompleteResult) => {
    const key = `${result.name.trim().toLowerCase()}::${result.address.trim().toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupePlaceResults(results: PlaceResult[]): PlaceResult[] {
  const seen = new Set<string>();

  return results.filter((result: PlaceResult) => {
    const key = `${result.name.trim().toLowerCase()}::${result.address.trim().toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export class MapboxService {
  static get accessToken(): string {
    return MAPBOX_ACCESS_TOKEN;
  }

  static get hasAccessToken(): boolean {
    return MAPBOX_ACCESS_TOKEN.length > 0;
  }

  static get styleId(): string {
    return MAPBOX_STYLE_ID;
  }

  static get tileUrlTemplate(): string | null {
    return buildMapboxTileUrl();
  }

  static async testApiKey(): Promise<DiagnosticResult> {
    const apis = {
      geocoding: false,
      autocomplete: false,
      directions: false,
    };

    try {
      if (!MAPBOX_ACCESS_TOKEN) {
        return {
          success: false,
          message: 'Mapbox access token is missing or invalid',
          apis,
        };
      }

      const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent('Lagos')}.json?limit=1&access_token=${MAPBOX_ACCESS_TOKEN}`;
      const geocodeResponse = await fetch(geocodeUrl);
      const geocodeData = await geocodeResponse.json();
      apis.geocoding = Array.isArray(geocodeData?.features);
      console.log('Mapbox geocoding diagnostic:', apis.geocoding ? '✅ Working' : '❌ Failed');

      const autocompleteUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent('Abuja')}.json?autocomplete=true&limit=5&access_token=${MAPBOX_ACCESS_TOKEN}`;
      const autocompleteResponse = await fetch(autocompleteUrl);
      const autocompleteData = await autocompleteResponse.json();
      apis.autocomplete = Array.isArray(autocompleteData?.features);
      console.log('Mapbox autocomplete diagnostic:', apis.autocomplete ? '✅ Working' : '❌ Failed');

      const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/7.4951,9.0820;3.3792,6.5244?overview=full&geometries=polyline&access_token=${MAPBOX_ACCESS_TOKEN}`;
      const directionsResponse = await fetch(directionsUrl);
      const directionsData = await directionsResponse.json();
      apis.directions = Array.isArray(directionsData?.routes);
      console.log('Mapbox directions diagnostic:', apis.directions ? '✅ Working' : '❌ Failed');

      const success = apis.geocoding && apis.autocomplete && apis.directions;

      return {
        success,
        message: success ? 'All Mapbox services are working.' : 'Some Mapbox services are unavailable or the token lacks access.',
        apis,
      };
    } catch (error) {
      console.error('Mapbox diagnostic error:', error);
      return {
        success: false,
        message: 'Failed to test Mapbox access token',
        apis,
      };
    }
  }

  static async autocomplete(input: string, location?: Location): Promise<AutocompleteResult[]> {
    const trimmedInput = input.trim();
    const catalogMatches = this.searchCatalog(trimmedInput);

    try {
      if (trimmedInput.length < 2) {
        return [];
      }

      const combinedResults: AutocompleteResult[] = toFallbackAutocompleteResults(catalogMatches);

      if (!MAPBOX_ACCESS_TOKEN) {
        console.warn('⚠️ Mapbox access token is missing, using local suggestions');
        return combinedResults.length > 0
          ? dedupeAutocompleteResults(combinedResults).slice(0, 8)
          : toFallbackAutocompleteResults(this.getMockPlaces(trimmedInput));
      }

      const searchboxResults = await this.getSearchboxAutocomplete(trimmedInput, location);
      if (searchboxResults.length > 0) {
        console.log('✅ Mapbox Search Box suggestions loaded:', searchboxResults.length);
        combinedResults.push(...searchboxResults);
      } else {
        console.warn('⚠️ Mapbox Search Box returned no suggestions, falling back to geocoding');
      }

      const mapboxQuery = `${trimmedInput}${buildCategoryBoost(trimmedInput)}`.trim();
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(mapboxQuery)}.json?${buildSearchQuery(trimmedInput, location)}&access_token=${MAPBOX_ACCESS_TOKEN}`;

      console.log('🔍 Mapbox autocomplete search for:', trimmedInput);
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Mapbox autocomplete HTTP error:', response.status, data);
        return combinedResults.length > 0
          ? dedupeAutocompleteResults(combinedResults).slice(0, 8)
          : toFallbackAutocompleteResults(this.getMockPlaces(trimmedInput));
      }

      const features = Array.isArray(data?.features) ? data.features : [];
      const normalized = features
        .sort((a: MapboxFeature, b: MapboxFeature) => scoreFeature(b, trimmedInput) - scoreFeature(a, trimmedInput))
        .map((feature: MapboxFeature, index: number) => normalizeFeature(feature, index))
        .filter((feature: AutocompleteResult | null): feature is AutocompleteResult => feature !== null);

      const mapboxPlaces = await this.searchPlaces(trimmedInput, location);
      const enrichedResults = [
        ...combinedResults,
        ...normalized,
        ...toFallbackAutocompleteResults(mapboxPlaces),
      ];
      const dedupedResults = dedupeAutocompleteResults(enrichedResults).slice(0, 10);

      if (dedupedResults.length > 0) {
        return dedupedResults;
      }

      console.warn('⚠️ Mapbox autocomplete returned no features, falling back to local suggestions');
      return toFallbackAutocompleteResults(this.getMockPlaces(trimmedInput));
    } catch (error) {
      console.error('❌ Error in autocomplete:', error);
      return toFallbackAutocompleteResults(this.getMockPlaces(trimmedInput));
    }
  }

  static async searchPlaces(query: string, location?: Location): Promise<PlaceResult[]> {
    const trimmedQuery = query.trim();
    const catalogMatches = this.searchCatalog(trimmedQuery);

    try {
      if (trimmedQuery.length < 2) {
        return [];
      }

      const combinedResults: PlaceResult[] = [...catalogMatches];

      if (!MAPBOX_ACCESS_TOKEN) {
        console.warn('⚠️ Mapbox access token is missing, using mock search results');
        return dedupePlaceResults(combinedResults.length > 0 ? combinedResults : this.getMockPlaces(trimmedQuery)).slice(0, 10);
      }

      const searchboxPlaces = await this.searchPlacesWithSearchbox(trimmedQuery, location);
      if (searchboxPlaces.length > 0) {
        console.log('✅ Mapbox Search Box place results loaded:', searchboxPlaces.length);
        combinedResults.push(...searchboxPlaces);
      } else {
        console.warn('⚠️ Mapbox Search Box returned no place results, falling back to geocoding');
      }

      const mapboxQuery = `${trimmedQuery}${buildCategoryBoost(trimmedQuery)}`.trim();
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(mapboxQuery)}.json?${buildSearchQuery(trimmedQuery, location)}&access_token=${MAPBOX_ACCESS_TOKEN}`;

      console.log('🔍 Mapbox place search for:', trimmedQuery);
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Mapbox search HTTP error:', response.status, data);
        return dedupePlaceResults(combinedResults.length > 0 ? combinedResults : this.getMockPlaces(trimmedQuery)).slice(0, 10);
      }

      const features = Array.isArray(data?.features) ? data.features : [];
      const normalized = features
        .sort((a: MapboxFeature, b: MapboxFeature) => scoreFeature(b, trimmedQuery) - scoreFeature(a, trimmedQuery))
        .map((feature: MapboxFeature, index: number) => normalizeFeature(feature, index))
        .filter((feature: AutocompleteResult | null): feature is AutocompleteResult => feature !== null)
        .map((feature: AutocompleteResult) => ({
          id: feature.id,
          name: feature.name,
          address: feature.address,
          location: feature.location,
        }));

      const dedupedResults = dedupePlaceResults([...combinedResults, ...normalized]).slice(0, 12);
      return dedupedResults.length > 0 ? dedupedResults : this.getMockPlaces(trimmedQuery);
    } catch (error) {
      console.error('❌ Error searching places:', error);
      return this.getMockPlaces(trimmedQuery);
    }
  }

  static getMockPlaces(query: string): PlaceResult[] {
    const lowerQuery = query.toLowerCase();
    const mockPlaces: PlaceResult[] = [
      {
        id: 'mock-1',
        name: 'Abuja City Centre',
        address: 'Central Business District, Abuja, Nigeria',
        location: { latitude: 9.0579, longitude: 7.4951 },
      },
      {
        id: 'mock-2',
        name: 'Lagos Island',
        address: 'Lagos Island, Lagos, Nigeria',
        location: { latitude: 6.4541, longitude: 3.3947 },
      },
      {
        id: 'mock-3',
        name: 'Port Harcourt City',
        address: 'Port Harcourt, Rivers State, Nigeria',
        location: { latitude: 4.8156, longitude: 7.0498 },
      },
      {
        id: 'mock-4',
        name: 'Ikeja City Mall',
        address: 'Obafemi Awolowo Way, Ikeja, Lagos, Nigeria',
        location: { latitude: 6.6018, longitude: 3.3515 },
      },
      {
        id: 'mock-5',
        name: 'Victoria Island',
        address: 'Victoria Island, Lagos, Nigeria',
        location: { latitude: 6.4281, longitude: 3.4219 },
      },
      {
        id: 'mock-6',
        name: 'Lekki Phase 1',
        address: 'Lekki Phase 1, Lagos, Nigeria',
        location: { latitude: 6.4474, longitude: 3.4739 },
      },
      {
        id: 'mock-7',
        name: 'Maitama District',
        address: 'Maitama, Abuja, Nigeria',
        location: { latitude: 9.082, longitude: 7.4951 },
      },
      {
        id: 'mock-8',
        name: 'Jabi Lake Mall',
        address: 'Bala Sokoto Way, Jabi, Abuja, Nigeria',
        location: { latitude: 9.0835, longitude: 7.4514 },
      },
      {
        id: 'mock-9',
        name: 'Murtala Muhammed International Airport',
        address: 'Airport Road, Ikeja, Lagos, Nigeria',
        location: { latitude: 6.5774, longitude: 3.3212 },
      },
      {
        id: 'mock-10',
        name: 'Nnamdi Azikiwe International Airport',
        address: 'Airport Road, Abuja, Nigeria',
        location: { latitude: 9.0068, longitude: 7.2632 },
      },
      {
        id: 'mock-11',
        name: 'Alausa Secretariat',
        address: 'Alausa, Ikeja, Lagos, Nigeria',
        location: { latitude: 6.6222, longitude: 3.3581 },
      },
      {
        id: 'mock-12',
        name: 'Yaba',
        address: 'Yaba, Lagos, Nigeria',
        location: { latitude: 6.5095, longitude: 3.3711 },
      },
      {
        id: 'mock-13',
        name: 'Surulere',
        address: 'Surulere, Lagos, Nigeria',
        location: { latitude: 6.5016, longitude: 3.3581 },
      },
      {
        id: 'mock-14',
        name: 'Onitsha Main Market',
        address: 'Onitsha, Anambra, Nigeria',
        location: { latitude: 6.1449, longitude: 6.7885 },
      },
      {
        id: 'mock-15',
        name: 'Aba',
        address: 'Aba, Abia, Nigeria',
        location: { latitude: 5.1167, longitude: 7.3667 },
      },
      {
        id: 'mock-16',
        name: 'Ibadan',
        address: 'Ibadan, Oyo, Nigeria',
        location: { latitude: 7.3775, longitude: 3.947 },
      },
      {
        id: 'mock-17',
        name: 'Kano City',
        address: 'Kano, Kano, Nigeria',
        location: { latitude: 12.0022, longitude: 8.592 },
      },
      {
        id: 'mock-18',
        name: 'Enugu',
        address: 'Enugu, Enugu, Nigeria',
        location: { latitude: 6.5244, longitude: 7.5086 },
      },
      {
        id: 'mock-19',
        name: 'Shoprite Ikeja City Mall',
        address: 'Obafemi Awolowo Way, Alausa, Ikeja, Lagos, Nigeria',
        location: { latitude: 6.6018, longitude: 3.3515 },
      },
      {
        id: 'mock-20',
        name: 'Shoprite Circle Mall',
        address: 'Jakande, Lekki, Lagos, Nigeria',
        location: { latitude: 6.4374, longitude: 3.5356 },
      },
      {
        id: 'mock-21',
        name: 'Shoprite Novare Lekki',
        address: 'Sangotedo, Lekki-Epe Expressway, Lagos, Nigeria',
        location: { latitude: 6.4698, longitude: 3.5852 },
      },
      {
        id: 'mock-22',
        name: 'Transcorp Hilton Abuja',
        address: '1 Aguiyi Ironsi Street, Maitama, Abuja, Nigeria',
        location: { latitude: 9.0762, longitude: 7.4967 },
      },
      {
        id: 'mock-23',
        name: 'Jabi Lake Mall Shoprite',
        address: 'Bala Sokoto Way, Jabi, Abuja, Nigeria',
        location: { latitude: 9.0835, longitude: 7.4514 },
      },
      {
        id: 'mock-24',
        name: 'Shoprite Maryland Mall',
        address: 'Ikorodu Road, Maryland, Lagos, Nigeria',
        location: { latitude: 6.5708, longitude: 3.3673 },
      },
      {
        id: 'mock-25',
        name: 'Domino\'s Pizza Victoria Island',
        address: 'Akin Adesola Street, Victoria Island, Lagos, Nigeria',
        location: { latitude: 6.4287, longitude: 3.4216 },
      },
      {
        id: 'mock-26',
        name: 'Eko Hotels & Suites',
        address: 'Plot 1415 Adetokunbo Ademola Street, Victoria Island, Lagos, Nigeria',
        location: { latitude: 6.4308, longitude: 3.4219 },
      },
      {
        id: 'mock-27',
        name: 'Murtala Muhammed Airport Terminal 2',
        address: 'Ikeja, Lagos, Nigeria',
        location: { latitude: 6.5777, longitude: 3.3211 },
      },
    ];

    if (!lowerQuery.trim()) {
      return mockPlaces.slice(0, 6);
    }

    const filtered = mockPlaces.filter((place: PlaceResult) => (
      place.name.toLowerCase().includes(lowerQuery) || place.address.toLowerCase().includes(lowerQuery)
    ));

    const catalogMatches = this.searchCatalog(query);

    if (catalogMatches.length > 0) {
      return dedupePlaceResults([...catalogMatches, ...filtered]).slice(0, 10);
    }

    return filtered.length > 0 ? filtered : mockPlaces.slice(0, 5);
  }

  static getNearbyCategories(): Array<{ id: string; label: string; query: string }> {
    return [
      { id: 'restaurants-near-me', label: 'Restaurants near me', query: 'restaurants near me' },
      { id: 'hotels-near-me', label: 'Hotels near me', query: 'hotels near me' },
      { id: 'shops-near-me', label: 'Shops near me', query: 'shops near me' },
      { id: 'hospitals-near-me', label: 'Hospitals near me', query: 'hospitals near me' },
      { id: 'banks-near-me', label: 'Banks near me', query: 'banks near me' },
      { id: 'fuel-near-me', label: 'Fuel near me', query: 'fuel near me' },
    ];
  }

  static async getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
    try {
      if (!placeId) {
        return null;
      }

      if (!MAPBOX_ACCESS_TOKEN) {
        const fallback = this.getMockPlaces(placeId)[0];
        return fallback ?? null;
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(placeId)}.json?limit=1&access_token=${MAPBOX_ACCESS_TOKEN}`;
      const response = await fetch(url);
      const data = await response.json();
      const feature = Array.isArray(data?.features) ? data.features[0] : null;

      if (!feature || !Array.isArray(feature.center) || feature.center.length < 2) {
        return null;
      }

      return {
        id: feature.id,
        name: feature.text || feature.place_name || 'Unknown place',
        address: feature.place_name || feature.text || 'Unknown address',
        location: {
          latitude: feature.center[1],
          longitude: feature.center[0],
        },
      };
    } catch (error) {
      console.error('Error getting place details:', error);
      return null;
    }
  }

  static async getDirections(origin: Location, destination: Location): Promise<DirectionsResult | null> {
    try {
      if (!MAPBOX_ACCESS_TOKEN) {
        console.warn('⚠️ Mapbox access token is missing, using estimated route');
        return this.getEstimatedDirections(origin, destination);
      }

      const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?alternatives=false&geometries=polyline&overview=full&steps=false&access_token=${MAPBOX_ACCESS_TOKEN}`;

      console.log('🗺️ Fetching Mapbox directions');
      const response = await fetch(url);
      const data = await response.json();
      const route = Array.isArray(data?.routes) ? data.routes[0] : null;

      if (!route) {
        console.error('❌ Mapbox directions error:', data);
        return this.getEstimatedDirections(origin, destination);
      }

      const decodedCoordinates = this.decodePolyline(route.geometry || '');

      return {
        distance: typeof route.distance === 'number' ? route.distance : 0,
        duration: typeof route.duration === 'number' ? route.duration : 0,
        coordinates: decodedCoordinates,
        polyline: route.geometry || '',
      };
    } catch (error) {
      console.error('❌ Error getting Mapbox directions:', error);
      return this.getEstimatedDirections(origin, destination);
    }
  }

  static async reverseGeocode(location: Location): Promise<string> {
    try {
      if (!MAPBOX_ACCESS_TOKEN) {
        return 'Current location';
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${location.longitude},${location.latitude}.json?limit=1&access_token=${MAPBOX_ACCESS_TOKEN}`;
      const response = await fetch(url);
      const data = await response.json();
      const feature = Array.isArray(data?.features) ? data.features[0] : null;

      return feature?.place_name || 'Current location';
    } catch (error) {
      console.error('Error reverse geocoding location:', error);
      return 'Current location';
    }
  }

  static getExternalDirectionsUrl(origin: Location, destination: Location): string {
    return `https://www.mapbox.com/directions/?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&profile=mapbox/driving`;
  }

  private static async getSearchboxAutocomplete(input: string, location?: Location): Promise<AutocompleteResult[]> {
    if (!MAPBOX_ACCESS_TOKEN) {
      return [];
    }

    try {
      const sessionToken = createSessionToken();
      const proximity = location
        ? `&proximity=${location.longitude},${location.latitude}`
        : '&proximity=7.4951,9.0579';
      const bbox = `&bbox=${NIGERIA_BOUNDS.minLongitude},${NIGERIA_BOUNDS.minLatitude},${NIGERIA_BOUNDS.maxLongitude},${NIGERIA_BOUNDS.maxLatitude}`;
      const url = `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(input)}&language=en&country=ng&limit=8&types=poi,address,street,place,locality,neighborhood${proximity}${bbox}&session_token=${sessionToken}&access_token=${MAPBOX_ACCESS_TOKEN}`;
      console.log('🔎 Mapbox Search Box suggest for:', input);
      const response = await fetch(url);
      const data = await response.json() as MapboxSearchboxSuggestResponse;

      if (!response.ok) {
        console.warn('⚠️ Mapbox Search Box suggest failed:', response.status, data);
        return [];
      }

      const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
      const retrieveResults = await Promise.all(suggestions.map(async (suggestion, index) => {
        const mapboxId = suggestion.mapbox_id;
        if (!mapboxId) {
          return null;
        }

        const retrieveUrl = `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(mapboxId)}?session_token=${sessionToken}&access_token=${MAPBOX_ACCESS_TOKEN}`;
        const retrieveResponse = await fetch(retrieveUrl);
        const retrieveData = await retrieveResponse.json() as MapboxSearchboxRetrieveResponse;
        if (!retrieveResponse.ok) {
          console.warn('⚠️ Mapbox Search Box retrieve failed:', retrieveResponse.status, retrieveData);
          return null;
        }

        const firstFeature = Array.isArray(retrieveData.features) ? retrieveData.features[0] : null;
        const latitude = firstFeature?.properties?.coordinates?.latitude;
        const longitude = firstFeature?.properties?.coordinates?.longitude;

        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          return null;
        }

        if (!isWithinNigeriaBounds(latitude, longitude) && !isNigeriaSearchboxSuggestion(suggestion)) {
          return null;
        }

        return {
          suggestion,
          result: normalizeSearchboxSuggestion(suggestion, normalizeCoordinateLocation(latitude, longitude), index),
        };
      }));

      return retrieveResults
        .filter((item): item is { suggestion: MapboxSearchboxSuggestion; result: AutocompleteResult | null } => item !== null)
        .sort((a, b) => scoreSearchboxSuggestion(b.suggestion, input) - scoreSearchboxSuggestion(a.suggestion, input))
        .map((item) => item.result)
        .filter((item: AutocompleteResult | null): item is AutocompleteResult => item !== null)
        .slice(0, 8);
    } catch (error) {
      console.error('❌ Error in Mapbox Search Box autocomplete:', error);
      return [];
    }
  }

  private static async searchPlacesWithSearchbox(query: string, location?: Location): Promise<PlaceResult[]> {
    const suggestions = await this.getSearchboxAutocomplete(query, location);
    return suggestions.map((result) => ({
      id: result.id,
      name: result.name,
      address: result.address,
      location: result.location,
    }));
  }

  private static searchCatalog(query: string): PlaceResult[] {
    const normalizedQuery = normalizeQueryValue(query);

    if (!normalizedQuery) {
      return [];
    }

    const catalog: PlaceCatalogEntry[] = [
      {
        id: 'catalog-shoprite-ikeja',
        name: 'Shoprite Ikeja City Mall',
        address: 'Obafemi Awolowo Way, Alausa, Ikeja, Lagos, Nigeria',
        location: { latitude: 6.6018, longitude: 3.3515 },
        tags: ['shoprite', 'mall', 'supermarket', 'store', 'shop', 'ikeja city mall', 'alausa', 'lagos'],
      },
      {
        id: 'catalog-shoprite-jabi',
        name: 'Shoprite Jabi Lake Mall',
        address: 'Bala Sokoto Way, Jabi, Abuja, Nigeria',
        location: { latitude: 9.0835, longitude: 7.4514 },
        tags: ['shoprite', 'jabi lake mall', 'mall', 'supermarket', 'store', 'abuja'],
      },
      {
        id: 'catalog-shoprite-circle',
        name: 'Shoprite Circle Mall',
        address: 'Jakande, Lekki, Lagos, Nigeria',
        location: { latitude: 6.4374, longitude: 3.5356 },
        tags: ['shoprite', 'circle mall', 'lekki', 'mall', 'supermarket', 'store'],
      },
      {
        id: 'catalog-transcorp-hilton',
        name: 'Transcorp Hilton Abuja',
        address: '1 Aguiyi Ironsi Street, Maitama, Abuja, Nigeria',
        location: { latitude: 9.0762, longitude: 7.4967 },
        tags: ['transcorp', 'hilton', 'hotel', 'maitama', 'abuja'],
      },
      {
        id: 'catalog-transcorp-beauty',
        name: 'Transcorp Beauty Studio',
        address: 'Inside Shoprite Jabi Lake Mall, Jabi, Abuja, Nigeria',
        location: { latitude: 9.0835, longitude: 7.4515 },
        tags: ['transcope beauty', 'transcorp beauty', 'beauty', 'shoprite', 'jabi lake mall', 'salon', 'abuja'],
      },
      {
        id: 'catalog-eko-hotels',
        name: 'Eko Hotels & Suites',
        address: 'Plot 1415 Adetokunbo Ademola Street, Victoria Island, Lagos, Nigeria',
        location: { latitude: 6.4308, longitude: 3.4219 },
        tags: ['hotel', 'victoria island', 'lagos', 'resort'],
      },
      {
        id: 'catalog-dominos-vi',
        name: 'Domino\'s Pizza Victoria Island',
        address: 'Akin Adesola Street, Victoria Island, Lagos, Nigeria',
        location: { latitude: 6.4287, longitude: 3.4216 },
        tags: ['restaurant', 'pizza', 'food', 'victoria island', 'lagos'],
      },
      {
        id: 'catalog-evercare',
        name: 'Evercare Hospital Lekki',
        address: 'Lekki-Epe Expressway, Lekki, Lagos, Nigeria',
        location: { latitude: 6.4692, longitude: 3.5858 },
        tags: ['hospital', 'clinic', 'medical', 'lekki', 'lagos'],
      },
      {
        id: 'catalog-gtbank-alausa',
        name: 'GTBank Alausa Branch',
        address: 'Alausa Secretariat, Ikeja, Lagos, Nigeria',
        location: { latitude: 6.6223, longitude: 3.3581 },
        tags: ['bank', 'atm', 'finance', 'ikeja', 'alausa', 'lagos'],
      },
      {
        id: 'catalog-nnpc-jabi',
        name: 'NNPC Filling Station Jabi',
        address: 'Jabi District, Abuja, Nigeria',
        location: { latitude: 9.0728, longitude: 7.4545 },
        tags: ['fuel', 'petrol', 'gas station', 'filling station', 'jabi', 'abuja'],
      },
    ];

    const scored = catalog
      .map((entry) => ({ entry, score: scoreCatalogEntry(entry, normalizedQuery) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((item) => ({
        id: item.entry.id,
        name: item.entry.name,
        address: item.entry.address,
        location: item.entry.location,
      } satisfies PlaceResult));

    return scored;
  }

  private static getEstimatedDirections(origin: Location, destination: Location): DirectionsResult {
    const R = 6371;
    const lat1 = origin.latitude * Math.PI / 180;
    const lat2 = destination.latitude * Math.PI / 180;
    const dLat = (destination.latitude - origin.latitude) * Math.PI / 180;
    const dLon = (destination.longitude - origin.longitude) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c * 1000;
    const avgSpeed = 40;
    const duration = (distance / 1000) / avgSpeed * 3600;

    const points: { latitude: number; longitude: number }[] = [];
    for (let i = 0; i <= 20; i += 1) {
      const fraction = i / 20;
      points.push({
        latitude: origin.latitude + ((destination.latitude - origin.latitude) * fraction),
        longitude: origin.longitude + ((destination.longitude - origin.longitude) * fraction),
      });
    }

    return {
      distance,
      duration,
      coordinates: points,
      polyline: '',
    };
  }

  private static decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
    const points: { latitude: number; longitude: number }[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let shift = 0;
      let result = 0;
      let byte = 0;

      do {
        byte = encoded.charCodeAt(index) - 63;
        index += 1;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < encoded.length + 1);

      const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : (result >> 1);
      lat += deltaLat;

      shift = 0;
      result = 0;

      do {
        byte = encoded.charCodeAt(index) - 63;
        index += 1;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < encoded.length + 1);

      const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : (result >> 1);
      lng += deltaLng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  }
}
