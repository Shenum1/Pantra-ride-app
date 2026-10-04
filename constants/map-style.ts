import type { MapStyleElement } from 'react-native-maps';
import Colors from '@/constants/colors';

// The ride map always renders in this single light, warm-neutral palette,
// independent of the app's light/dark theme setting — the same convention
// most navigation-grade ride-hailing maps use, since a dark map tile set
// reads as low-effort and hurts legibility of the route against roads.
export const MAP_COLORS = {
  background: '#F7F4EF',
  land: '#F7F4EF',
  park: '#E7F1EA',
  water: '#DCE8F5',
  majorRoad: '#C7D0DA',
  majorRoadStroke: '#9BA8B6',
  secondaryRoad: '#E6E4DF',
  minorRoad: '#EFEDE8',
  label: '#2E2C28',
  labelSecondary: '#9C998C',
  route: Colors.light.primary,
  routeCasing: '#FFFFFF',
  pickup: Colors.light.primary,
  // Colors.light.secondary is the 3-digit shorthand "#333"; expanded to 6
  // digits here since the static-map marker color param needs a full hex.
  dropoff: '#333333',
} as const;

// Google Maps JSON style array — applied via <MapView customMapStyle={...}>
// on native. Suppresses default POI clutter/icons and imposes the muted
// road hierarchy so the Pantra route stays the strongest element on screen.
export const PANTRA_MAP_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: MAP_COLORS.land }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: MAP_COLORS.labelSecondary }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: MAP_COLORS.land }] },

  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: MAP_COLORS.label }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: MAP_COLORS.labelSecondary }] },

  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: MAP_COLORS.park }] },
  { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },

  { featureType: 'road', elementType: 'geometry', stylers: [{ color: MAP_COLORS.minorRoad }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: MAP_COLORS.labelSecondary }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: MAP_COLORS.secondaryRoad }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: MAP_COLORS.majorRoad }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: MAP_COLORS.majorRoadStroke }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: MAP_COLORS.label }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: MAP_COLORS.minorRoad }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },

  { featureType: 'transit', stylers: [{ visibility: 'off' }] },

  { featureType: 'water', elementType: 'geometry', stylers: [{ color: MAP_COLORS.water }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: MAP_COLORS.labelSecondary }] },
];

// Same visual language, expressed as Google Static Maps API `style` query
// fragments (a different string format from the JSON style array above),
// for the static-map fallback path used on web and as the native fallback.
export const PANTRA_STATIC_MAP_STYLE_PARAMS: string[] = [
  'feature:all|element:labels.icon|visibility:off',
  `feature:landscape|element:geometry|color:0x${MAP_COLORS.land.slice(1)}`,
  'feature:poi|visibility:off',
  `feature:poi.park|element:geometry|visibility:on|color:0x${MAP_COLORS.park.slice(1)}`,
  'feature:poi.park|element:labels|visibility:off',
  'feature:administrative|element:geometry|visibility:off',
  `feature:administrative.locality|element:labels.text.fill|color:0x${MAP_COLORS.label.slice(1)}`,
  `feature:administrative.neighborhood|element:labels.text.fill|color:0x${MAP_COLORS.labelSecondary.slice(1)}`,
  `feature:road|element:geometry|color:0x${MAP_COLORS.minorRoad.slice(1)}`,
  `feature:road|element:labels.text.fill|color:0x${MAP_COLORS.labelSecondary.slice(1)}`,
  `feature:road.arterial|element:geometry|color:0x${MAP_COLORS.secondaryRoad.slice(1)}`,
  `feature:road.highway|element:geometry.fill|color:0x${MAP_COLORS.majorRoad.slice(1)}`,
  `feature:road.highway|element:geometry.stroke|color:0x${MAP_COLORS.majorRoadStroke.slice(1)}`,
  'feature:road.local|element:labels|visibility:off',
  'feature:transit|visibility:off',
  `feature:water|element:geometry|color:0x${MAP_COLORS.water.slice(1)}`,
];
