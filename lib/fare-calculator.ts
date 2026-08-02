import { TIER_RATES, TierId, PLATFORM_COMMISSION_RATE, WAITING_CHARGE_CONFIG } from './pricing-config';

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
  zoneFee: number;
  total: number;
}

// Pricing pipeline, in order:
//   1. Metered fare (base + distance + time)
//   2. Minimum fare clamp
//   3. Surge multiplier (applied AFTER the minimum-fare clamp, so a
//      surged short trip is minFare * surge, not just minFare)
//   4. (caller's responsibility — see applyRideDiscounts) rider discounts
//      applied to the metered fare only
//   5. Flat platform fees (bookingFee/serviceFee/zoneFee) added on top —
//      never surged, never discounted, never negotiated.
export function calculateFareBreakdown(
  distanceKm: number,
  durationMin: number,
  tierId: string,
  surgeMultiplier = 1,
  zoneFee = 0
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
    zoneFee,
    total: meteredSubtotal + t.bookingFee + t.serviceFee + zoneFee,
  };
}

export function calculateFare(
  distanceKm: number,
  durationMin: number,
  tierId: string,
  surgeMultiplier = 1,
  zoneFee = 0
): number {
  return calculateFareBreakdown(distanceKm, durationMin, tierId, surgeMultiplier, zoneFee).total;
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
// (base + distance + time + surge). bookingFee/serviceFee/zoneFee are
// platform revenue excluded from commission because the driver never earns
// them; waitingCharge is excluded for the opposite reason — it's 100% driver
// compensation for lost time, not platform revenue. Either way, none of the
// four are ever multiplied by the commission rate.
export function calculateDriverPayout(
  fare: number,
  bookingFee = 0,
  serviceFee = 0,
  zoneFee = 0,
  waitingCharge = 0
): DriverPayout {
  const meteredFare = Math.max(fare - bookingFee - serviceFee - zoneFee - waitingCharge, 0);
  const commission = meteredFare * PLATFORM_COMMISSION_RATE;

  return {
    meteredFare,
    commission,
    netAmount: fare - commission,
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

export interface FareOfferPreset {
  label: string;
  percent: number;
  amount: number;
}

const OFFER_PRESET_PERCENTS = [-20, -10, 0, 10, 20];

// Preset rider-facing negotiation options (replaces the old ±10% self-adjust
// slider). Each amount is floor-guarded to the tier's minimum fare — a rider
// can propose less, but the platform will never accept below minFare.
export function getOfferPresets(meteredFare: number, tierId: string): FareOfferPreset[] {
  return OFFER_PRESET_PERCENTS.map((percent) => ({
    label: percent === 0 ? 'Metered fare' : `${percent > 0 ? '+' : ''}${percent}%`,
    percent,
    amount: clampToMinFare(Math.round(meteredFare * (1 + percent / 100)), tierId),
  }));
}

export interface OfferValidationResult {
  valid: boolean;
  reason?: string;
}

// Guards against an offer below the tier's minimum fare or an absurd,
// likely-mistyped overpay. The driver still has final say — this only
// prevents obviously invalid offers from ever reaching the marketplace.
export function validateOfferedFare(meteredFare: number, offeredFare: number, tierId: string): OfferValidationResult {
  const resolvedTierId = (tierId in TIER_RATES ? tierId : 'standard') as TierId;
  const minFare = TIER_RATES[resolvedTierId].minFare;

  if (!Number.isFinite(offeredFare) || offeredFare <= 0) {
    return { valid: false, reason: 'Enter a valid offer amount' };
  }
  if (offeredFare < minFare) {
    return { valid: false, reason: `Offer must be at least ₦${minFare}` };
  }
  if (offeredFare > meteredFare * 2) {
    return { valid: false, reason: 'Offer is unreasonably high' };
  }

  return { valid: true };
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
