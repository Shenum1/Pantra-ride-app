// Pantra ride tiers — Bolt Nigeria rates reduced by 5%
export const TIER_RATES = {
  standard: { id: 'standard', name: 'Standard', base: 333, perKm: 90,  perMin: 8,  minFare: 665 },
  comfort:  { id: 'comfort',  name: 'Comfort',  base: 475, perKm: 124, perMin: 10, minFare: 855 },
  xl:       { id: 'xl',       name: 'XL',       base: 570, perKm: 143, perMin: 11, minFare: 950 },
} as const;

export type TierId = keyof typeof TIER_RATES;
