// Pantra ride tiers — Bolt Nigeria rates reduced by 5%
// bookingFee/serviceFee are flat, platform-owned charges: never subject to
// surge, shared-ride discount, promo codes, or rider fare negotiation.
export const TIER_RATES = {
  standard: { id: 'standard', name: 'Standard', base: 333, perKm: 90,  perMin: 8,  minFare: 665, bookingFee: 100, serviceFee: 0 },
  comfort:  { id: 'comfort',  name: 'Comfort',  base: 475, perKm: 124, perMin: 10, minFare: 855, bookingFee: 100, serviceFee: 0 },
  xl:       { id: 'xl',       name: 'XL',       base: 570, perKm: 143, perMin: 11, minFare: 950, bookingFee: 100, serviceFee: 0 },
} as const;

export type TierId = keyof typeof TIER_RATES;

// Single source of truth for the platform's cut of every completed ride's fare.
// Was previously duplicated as the literal 0.2 / 0.8 in three places in
// lib/firebase-driver-service.ts — change it here only.
export const PLATFORM_COMMISSION_RATE = 0.2;
export const DRIVER_PAYOUT_RATE = 1 - PLATFORM_COMMISSION_RATE;

// Shared-ride discount, applied to the metered fare only (never to flat fees).
export const SHARED_RIDE_DISCOUNT_MULTIPLIER = 0.8;
