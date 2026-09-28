// Minimal-light (Uber/Bolt-style) map theme — the single source of truth for both
// the live react-native-maps customMapStyle and the Google Static Maps fallback
// (lib/google-maps-service.ts), so the two rendering paths never drift apart.
//
// Deliberately keeps road labels (street names) visible — a ride app needs them —
// and only strips POI/transit clutter, unlike a generic "hide everything" template.

export interface MapStyleRule {
  featureType?: string;
  elementType?: string;
  stylers: Array<{ color?: string; visibility?: string; weight?: number; saturation?: number }>;
}

export const MINIMAL_LIGHT_MAP_STYLE: MapStyleRule[] = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f3' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f3' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e3e8dd' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e6e6e6' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cfe0ec' }] },
];

// Reuses the pickup=teal / dropoff=light-blue convention already shown to riders on
// the search and ride-confirmation screens (app/search.tsx, app/ride-confirmation.tsx),
// instead of introducing a third pickup/dropoff color pairing just for the map.
export const MAP_MARKER_COLORS = {
  pickup: '#14B8A6',
  dropoff: '#7DD3FC',
  driver: '#0F172A',
} as const;

// Google Maps APIs (Static Maps included) take hex colors as 0xRRGGBB, not #RRGGBB.
export function toStaticMapHex(color: string): string {
  return color.startsWith('#') ? `0x${color.slice(1)}` : color;
}

// Converts MINIMAL_LIGHT_MAP_STYLE into Google Static Maps API `&style=` fragments
// (feature:X|element:Y|color:0xRRGGBB|visibility:off), so the fallback static image
// (used whenever the live map times out) matches the live map's look.
export function staticMapStyleParams(rules: MapStyleRule[]): string {
  return rules
    .map((rule) => {
      const parts = [
        `feature:${rule.featureType ?? 'all'}`,
        `element:${rule.elementType ?? 'all'}`,
        ...rule.stylers.map((styler) => {
          if (styler.color) return `color:${toStaticMapHex(styler.color)}`;
          if (styler.visibility) return `visibility:${styler.visibility}`;
          if (styler.weight !== undefined) return `weight:${styler.weight}`;
          if (styler.saturation !== undefined) return `saturation:${styler.saturation}`;
          return '';
        }).filter(Boolean),
      ];
      return `&style=${parts.join('|')}`;
    })
    .join('');
}
