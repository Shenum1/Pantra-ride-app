import { TIER_RATES, TierId, PLATFORM_COMMISSION_RATE } from './pricing-config';

export interface FareBreakdown {
  tierId: TierId;
  base: number;
  distanceCost: number;
  timeCost: number;
  surgeMultiplier: number;
  // (base + distance + time), clamped to the tier's minimum fare, then
  // surged — everything before flat fees or rider discounts are applied.
  meteredSubtotal: number;
  minFareApplied: boolean;
  bookingFee: number;
  serviceFee: number;
  total: number;
}

// Pricing pipeline, in order:
//   1. Metered fare (base + distance + time)
//   2. Minimum fare clamp
//   3. Surge multiplier (applied AFTER the minimum-fare clamp, so a
//      surged short trip is minFare * surge, not just minFare)
//   4. (caller's responsibility — see applyRideDiscounts) rider discounts
//      applied to the metered fare only
//   5. Flat platform fees (bookingFee/serviceFee) added on top — never
//      surged, never discounted, never negotiated.
export function calculateFareBreakdown(
  distanceKm: number,
  durationMin: number,
  tierId: string,
  surgeMultiplier = 1
): FareBreakdown {
  const resolvedTierId = (tierId in TIER_RATES ? tierId : 'standard') as TierId;
  const t = TIER_RATES[resolvedTierId];

  const distanceCost = distanceKm * t.perKm;
  const timeCost = durationMin * t.perMin;
  const meteredRaw = t.base + distanceCost + timeCost;              // Step 1
  const roundedMetered = Math.round(meteredRaw);
  const meteredFloored = Math.max(roundedMetered, t.minFare);        // Step 2
  const meteredSubtotal = Math.round(meteredFloored * surgeMultiplier); // Step 3

  return {
    tierId: resolvedTierId,
    base: t.base,
    distanceCost: Math.round(distanceCost),
    timeCost: Math.round(timeCost),
    surgeMultiplier,
    meteredSubtotal,
    minFareApplied: roundedMetered < t.minFare,
    bookingFee: t.bookingFee,
    serviceFee: t.serviceFee,
    total: meteredSubtotal + t.bookingFee + t.serviceFee,
  };
}

export function calculateFare(
  distanceKm: number,
  durationMin: number,
  tierId: string,
  surgeMultiplier = 1
): number {
  return calculateFareBreakdown(distanceKm, durationMin, tierId, surgeMultiplier).total;
}

// Guarantees a price (after shared-ride/promo discounts, etc.) never drops
// below the tier's configured minimum fare.
export function clampToMinFare(price: number, tierId: string): number {
  const resolvedTierId = (tierId in TIER_RATES ? tierId : 'standard') as TierId;
  return Math.max(price, TIER_RATES[resolvedTierId].minFare);
}

export interface RideDiscountInput {
  // e.g. 0.8 for a 20% shared-ride discount; 1 or omitted = no discount.
  sharedRideDiscountMultiplier?: number;
  promo?: { discountPercentage: number; maxDiscountNGN?: number | null } | null;
}

// Applies rider-facing discounts (shared ride, promo — and, in future, an
// accepted negotiated fare) to the METERED fare only. Booking/service fees
// and any other platform-owned charges are intentionally never passed
// through this function, so they can never be discounted, promo'd away, or
// negotiated down — callers must add flat fees separately, after this runs.
export function applyRideDiscounts(
  meteredFare: number,
  tierId: string,
  discounts: RideDiscountInput
): number {
  let price = meteredFare;

  const sharedMultiplier = discounts.sharedRideDiscountMultiplier;
  if (sharedMultiplier !== undefined && sharedMultiplier !== 1) {
    price = Math.round(price * sharedMultiplier);
  }

  if (discounts.promo) {
    const rawDiscount = price * (discounts.promo.discountPercentage / 100);
    const maxCap = discounts.promo.maxDiscountNGN ?? Infinity;
    price = Math.round(price - Math.min(rawDiscount, maxCap));
  }

  return clampToMinFare(price, tierId);
}

export interface DriverPayout {
  meteredFare: number;
  commission: number;
  netAmount: number;
}

// Platform commission applies only to the metered portion of the fare
// (base + distance + time + surge) — never to flat booking/service fees.
// The driver keeps those fees in full; only the commission is deducted
// from the total to produce the driver's net payout.
export function calculateDriverPayout(
  fare: number,
  bookingFee = 0,
  serviceFee = 0
): DriverPayout {
  const meteredFare = Math.max(fare - bookingFee - serviceFee, 0);
  const commission = meteredFare * PLATFORM_COMMISSION_RATE;

  return {
    meteredFare,
    commission,
    netAmount: fare - commission,
  };
}

export function calculateAllTierFares(
  distanceKm: number,
  durationMin: number,
  surgeMultiplier = 1
): Record<string, number> {
  return {
    standard: calculateFare(distanceKm, durationMin, 'standard', surgeMultiplier),
    comfort:  calculateFare(distanceKm, durationMin, 'comfort',  surgeMultiplier),
    xl:       calculateFare(distanceKm, durationMin, 'xl',       surgeMultiplier),
  };
}
