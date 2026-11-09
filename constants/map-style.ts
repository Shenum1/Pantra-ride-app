import type { MapStyleElement } from 'react-native-maps';
import Colors from '@/constants/colors';

// The ride map always renders in this single light, warm-neutral palette,
// independent of the app's light/dark theme setting — the same convention
// most navigation-grade ride-hailing maps use, since a dark map tile set
// reads as low-effort and hurts legibility of the route against roads.
export const MAP_COLORS = {
  land: '#EFEBE2',
  // Google draws built-up areas and building footprints as one feature
  // (landscape.man_made), so a fill colour floods whole towns. Built-up land
  // keeps the land colour and buildings show only as faint outlines.
  buildingOutline: '#E3DCCF',
  park: '#DCEBD5',
  parkLabel: '#5C7F55',
  water: '#C9DDF0',
  waterLabel: '#5F7E9C',
  // Road hierarchy: soft amber highways on top, then white roads separated
  // from the land by progressively lighter strokes.
  highway: '#FBE6B3',
  highwayStroke: '#E5C27A',
  arterial: '#FFFFFF',
  arterialStroke: '#C9BEAB',
  localRoad: '#FFFFFF',
  localRoadStroke: '#D4CBBB',
  label: '#2E2C28',
  labelNeighborhood: '#6B665E',
  labelRoad: '#5E5A53',
  labelMuted: '#86817A',
  labelHalo: '#FFFFFF',
  route: Colors.light.primary,
  // Dark-blue casing: roads are white, so a white casing would disappear.
  routeCasing: '#0B3D91',
  pickup: Colors.light.primary,
  dropoff: '#1F2937',
  vehicle: '#0F172A',
} as const;

// Google Maps JSON style array — applied via <MapView customMapStyle={...}>
// on native. Rules apply in order, later rules overriding earlier ones.
// Street names, neighbourhoods and landmarks (fuel stations, pharmacies,
// hospitals, schools, markets, malls, restaurants, parks) stay visible
// because riders and drivers navigate by them; POI icons are toned down so
// the Pantra route remains the strongest element on screen.
//
// This is a code-defined (JSON) style. If a Google Cloud Map ID is ever set
// through `googleMapId`, the SDK ignores `customMapStyle`, so the two must
// not be combined.
export const PANTRA_MAP_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: MAP_COLORS.land }] },
  { elementType: 'labels.text.fill', stylers: [{ color: MAP_COLORS.labelMuted }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: MAP_COLORS.labelHalo }, { weight: 3 }] },

  { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ color: MAP_COLORS.land }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: MAP_COLORS.buildingOutline }] },

  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: MAP_COLORS.label }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: MAP_COLORS.labelNeighborhood }] },

  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: MAP_COLORS.labelMuted }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ saturation: -40 }, { lightness: 10 }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: MAP_COLORS.park }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: MAP_COLORS.parkLabel }] },

  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: MAP_COLORS.localRoad }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: MAP_COLORS.localRoadStroke }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: MAP_COLORS.labelRoad }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: MAP_COLORS.labelMuted }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: MAP_COLORS.arterial }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: MAP_COLORS.arterialStroke }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: MAP_COLORS.highway }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: MAP_COLORS.highwayStroke }] },

  // Rail lines and bus stops add clutter without helping a pickup; airports
  // and rail stations stay because they are common ride destinations.
  { featureType: 'transit.line', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.station.bus', stylers: [{ visibility: 'off' }] },

  { featureType: 'water', elementType: 'geometry', stylers: [{ color: MAP_COLORS.water }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: MAP_COLORS.waterLabel }] },
];

function toStaticStylerValue(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? `0x${value.slice(1)}` : String(value);
}

// Converts a JSON style array into Google Static Maps API `style` query
// fragments (feature:…|element:…|key:value), so the static-map path used on
// web and in scripts/compare-map-styles.ts can never drift from native.
export function toStaticMapStyleParams(style: MapStyleElement[]): string[] {
  return style.map((rule) => {
    const stylers = rule.stylers.flatMap((styler) =>
      Object.entries(styler).map(([key, value]) => `${key}:${toStaticStylerValue(value)}`)
    );
    return [`feature:${rule.featureType ?? 'all'}`, `element:${rule.elementType ?? 'all'}`, ...stylers].join('|');
  });
}

export const PANTRA_STATIC_MAP_STYLE_PARAMS: string[] = toStaticMapStyleParams(PANTRA_MAP_STYLE);
