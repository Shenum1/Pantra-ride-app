import { describe, expect, it } from 'vitest';

import {
  MAP_COLORS,
  PANTRA_MAP_STYLE,
  PANTRA_STATIC_MAP_STYLE_PARAMS,
  toStaticMapStyleParams,
} from '@/constants/map-style';

function hides(featureType: string | undefined, elementType?: string) {
  return PANTRA_MAP_STYLE.some((rule) =>
    rule.featureType === featureType &&
    (elementType === undefined || rule.elementType === undefined || rule.elementType === elementType) &&
    rule.stylers.some((styler) => (styler as { visibility?: string }).visibility === 'off')
  );
}

// Guards the regressions behind the "bland map" report: the previous style
// hid every POI, every icon and every local street name.
describe('PANTRA_MAP_STYLE', () => {
  it('keeps points of interest and their icons visible', () => {
    expect(hides('poi')).toBe(false);
    expect(hides('poi.business')).toBe(false);
    expect(hides('poi.medical')).toBe(false);
    expect(hides('poi.school')).toBe(false);
    expect(hides(undefined, 'labels.icon')).toBe(false);
    expect(hides('poi', 'labels.icon')).toBe(false);
  });

  it('keeps local street names and neighbourhood names visible', () => {
    expect(hides('road.local', 'labels')).toBe(false);
    expect(hides('road', 'labels')).toBe(false);
    expect(hides('administrative.neighborhood')).toBe(false);
    expect(hides('administrative.locality')).toBe(false);
  });

  it('gives highways a distinct colour from local roads', () => {
    const fillOf = (featureType: string) => PANTRA_MAP_STYLE.find(
      (rule) => rule.featureType === featureType && rule.elementType === 'geometry.fill'
    )?.stylers[0];
    expect(fillOf('road.highway')).toEqual({ color: MAP_COLORS.highway });
    expect(fillOf('road')).toEqual({ color: MAP_COLORS.localRoad });
    expect(MAP_COLORS.highway).not.toBe(MAP_COLORS.localRoad);
  });

  it('does not flood built-up areas with a fill colour', () => {
    const manMadeFill = PANTRA_MAP_STYLE.find(
      (rule) => rule.featureType === 'landscape.man_made' && rule.elementType === 'geometry.fill'
    );
    expect(manMadeFill?.stylers).toEqual([{ color: MAP_COLORS.land }]);
  });
});

describe('toStaticMapStyleParams', () => {
  it('converts JSON rules into Static Maps style fragments', () => {
    expect(toStaticMapStyleParams([
      { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#FBE6B3' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }, { weight: 3 }] },
      { featureType: 'poi', elementType: 'labels.icon', stylers: [{ saturation: -40 }, { lightness: 10 }] },
      { featureType: 'transit.line', stylers: [{ visibility: 'off' }] },
    ])).toEqual([
      'feature:road.highway|element:geometry.fill|color:0xFBE6B3',
      'feature:all|element:labels.text.stroke|color:0xFFFFFF|weight:3',
      'feature:poi|element:labels.icon|saturation:-40|lightness:10',
      'feature:transit.line|element:all|visibility:off',
    ]);
  });

  it('derives the web/static style from the native style, rule for rule', () => {
    expect(PANTRA_STATIC_MAP_STYLE_PARAMS).toEqual(toStaticMapStyleParams(PANTRA_MAP_STYLE));
    expect(PANTRA_STATIC_MAP_STYLE_PARAMS).toHaveLength(PANTRA_MAP_STYLE.length);
  });
});
