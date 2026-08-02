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

// Fixed zone surcharges — same platform-owned treatment as bookingFee/serviceFee
// (never surged, discounted, or negotiated; excluded from driver commission).
// Toll fees are deliberately not modeled yet — there's no toll-data source
// (routing API or driver input) in this stack to populate a per-trip amount.
export const ZONE_FEES = {
  airportPickup: 500,
  airportDropoff: 300,
} as const;

// Waiting charge: free for the first `graceMinutes` after the driver arrives
// at pickup, then `perMinuteRate` for every minute after that until the trip
// actually starts. Unlike bookingFee/serviceFee/zoneFee, this compensates the
// DRIVER directly for lost time — it is excluded from platform commission,
// same mechanism, opposite reason (those are platform revenue; this isn't).
export const WAITING_CHARGE_CONFIG = {
  graceMinutes: 3,
  perMinuteRate: 40,
} as const;

// Rider-initiated cancellation fees. Free within `freeWindowSeconds` of the
// driver accepting; a flat fee afterward, higher once the driver has already
// arrived at pickup. Unlike waiting charges, this goes through the NORMAL
// 80/20 commission split (see calculateDriverPayout) — it's treated like any
// other fare, not driver-only compensation. Driver-side no-show/cancellation
// policy (compensating the rider) is out of scope for this pass.
export const CANCELLATION_FEE_CONFIG = {
  freeWindowSeconds: 60,
  afterAcceptFee: 200,
  afterArrivalFee: 500,
} as const;
