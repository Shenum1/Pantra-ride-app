import { TIER_RATES, TierId, TierRatesTable, PLATFORM_COMMISSION_RATE, WAITING_CHARGE_CONFIG } from './pricing-config';

export interface FareBreakdown {
  tierId: TierId;
  base: number;
  distanceCost: number;
  timeCost: number;
  surgeMultiplier: number;
  trafficMultiplier: number;
  // (base + distance + time), clamped to the tier's minimum fare, then
  // surged and traffic-multiplied — everything before flat fees or rider
  // discounts are applied.
  meteredSubtotal: number;
  minFareApplied: boolean;
  bookingFee: number;
  serviceFee: number;
  zoneFee: number;
  priorityFee: number;
  total: number;
}

// Pricing pipeline, in order:
//   1. Metered fare (base + distance + time)
//   2. Minimum fare clamp
//   3. Surge multiplier * traffic multiplier (applied AFTER the minimum-fare
//      clamp, so a surged short trip is minFare * multiplier, not just minFare)
//   4. (caller's responsibility — see applyRideDiscounts) rider discounts
//      applied to the metered fare only
//   5. Flat platform fees (bookingFee/serviceFee/zoneFee/priorityFee) added
//      on top — never surged, never discounted, never negotiated.
//
// `tierRates` defaults to the hardcoded TIER_RATES fallback but is normally
// the live, admin-tunable table useRideStore fetches from `pricing_tier_config`
// (merged over TIER_RATES) — see supabase-schema-pricing-config.sql.
export function calculateFareBreakdown(
  distanceKm: number,
  durationMin: number,
  tierId: string,
  surgeMultiplier = 1,
  zoneFee = 0,
  trafficMultiplier = 1,
  priorityFee = 0,
  tierRates: TierRatesTable = TIER_RATES
): FareBreakdown {
  const resolvedTierId = (tierId in tierRates ? tierId : 'standard') as TierId;
  const t = tierRates[resolvedTierId];

  const distanceCost = distanceKm * t.perKm;
  const timeCost = durationMin * t.perMin;
  const meteredRaw = t.base + distanceCost + timeCost;              // Step 1
  const roundedMetered = Math.round(meteredRaw);
  const meteredFloored = Math.max(roundedMetered, t.minFare);        // Step 2
  const combinedMultiplier = surgeMultiplier * trafficMultiplier;
  const meteredSubtotal = Math.round(meteredFloored * combinedMultiplier); // Step 3

  return {
    tierId: resolvedTierId,
    base: t.base,
    distanceCost: Math.round(distanceCost),
    timeCost: Math.round(timeCost),
    surgeMultiplier,
    trafficMultiplier,
    meteredSubtotal,
    minFareApplied: roundedMetered < t.minFare,
    bookingFee: t.bookingFee,
    serviceFee: t.serviceFee,
    zoneFee,
    priorityFee,
    total: meteredSubtotal + t.bookingFee + t.serviceFee + zoneFee + priorityFee,
  };
}

export function calculateFare(
  distanceKm: number,
  durationMin: number,
  tierId: string,
  surgeMultiplier = 1,
  zoneFee = 0,
  trafficMultiplier = 1,
  priorityFee = 0,
  tierRates: TierRatesTable = TIER_RATES
): number {
  return calculateFareBreakdown(distanceKm, durationMin, tierId, surgeMultiplier, zoneFee, trafficMultiplier, priorityFee, tierRates).total;
}

// Guarantees a price (after shared-ride/promo discounts, etc.) never drops
// below the tier's configured minimum fare.
export function clampToMinFare(price: number, tierId: string, tierRates: TierRatesTable = TIER_RATES): number {
  const resolvedTierId = (tierId in tierRates ? tierId : 'standard') as TierId;
  return Math.max(price, tierRates[resolvedTierId].minFare);
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
  discounts: RideDiscountInput,
  tierRates: TierRatesTable = TIER_RATES
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

  return clampToMinFare(price, tierId, tierRates);
}

export interface DriverPayout {
  meteredFare: number;
  commission: number;
  netAmount: number;
  // The rate actually applied, captured alongside the amounts so callers can
  // persist it on the ride row — see PLATFORM_COMMISSION_RATE's doc comment.
  commissionRate: number;
}

// Platform commission applies only to the metered portion of the fare
// (base + distance + time + surge). bookingFee/serviceFee/zoneFee/priorityFee
// are platform revenue excluded from commission because the driver never earns
// them; waitingCharge is excluded for the opposite reason — it's 100% driver
// compensation for lost time, not platform revenue. Either way, none of these
// are ever multiplied by the commission rate. Commission mechanism itself
// (flat PLATFORM_COMMISSION_RATE, no phased ramp-up) is deliberately
// unchanged here.
//
// This is the single authoritative commission calculation — every caller
// (driver earnings list/stats, ride-completion snapshot, admin revenue
// totals) must go through this function rather than re-deriving the split.
export function calculateDriverPayout(
  fare: number,
  bookingFee = 0,
  serviceFee = 0,
  zoneFee = 0,
  waitingCharge = 0,
  priorityFee = 0
): DriverPayout {
  const meteredFare = Math.max(fare - bookingFee - serviceFee - zoneFee - waitingCharge - priorityFee, 0);
  const commission = meteredFare * PLATFORM_COMMISSION_RATE;

  return {
    meteredFare,
    commission,
    netAmount: fare - commission,
    commissionRate: PLATFORM_COMMISSION_RATE,
  };
}

// Free for the first `graceMinutes` after the driver arrives at pickup, then
// `perMinuteRate` per minute after that until the trip actually starts.
// Computed once startedAt is known (can't be known upfront at booking time),
// then added directly to the ride's fare.
export function calculateWaitingCharge(
  arrivedAt: Date | null | undefined,
  startedAt: Date | null | undefined,
  config: { graceMinutes: number; perMinuteRate: number } = WAITING_CHARGE_CONFIG
): number {
  if (!arrivedAt || !startedAt) {
    return 0;
  }

  const waitedMinutes = (startedAt.getTime() - arrivedAt.getTime()) / 60000;
  const chargeableMinutes = Math.max(0, waitedMinutes - config.graceMinutes);
  return Math.round(chargeableMinutes * config.perMinuteRate);
}

export function calculateAllTierFares(
  distanceKm: number,
  durationMin: number,
  surgeMultiplier = 1,
  trafficMultiplier = 1,
  tierRates: TierRatesTable = TIER_RATES
): Record<string, number> {
  return {
    standard: calculateFare(distanceKm, durationMin, 'standard', surgeMultiplier, 0, trafficMultiplier, 0, tierRates),
    comfort:  calculateFare(distanceKm, durationMin, 'comfort',  surgeMultiplier, 0, trafficMultiplier, 0, tierRates),
    xl:       calculateFare(distanceKm, durationMin, 'xl',       surgeMultiplier, 0, trafficMultiplier, 0, tierRates),
  };
}
