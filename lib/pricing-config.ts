// Pantra ride tiers. Previous rates (Bolt NG rates reduced 5%) consistently
// under-priced trips vs. what drivers were willing to accept — e.g. a 15km
// Abuja trip metered at ~₦1,900 pre-fees. Rates below are those figures x3,
// which puts the same trip in the ~₦5,700+ range before surge/traffic, and
// every tier's minFare clears the ₦1,000 floor on its own.
// bookingFee/serviceFee are flat, platform-owned charges: never subject to
// surge, shared-ride discount, promo codes, or rider fare negotiation.
// These are DEFAULTS ONLY — the live values riders are actually charged come
// from the `pricing_tier_config` table (see supabase-schema-pricing-config.sql),
// fetched in useRideStore and merged over this table, so rates can be tuned
// from Supabase without an app release. This table is the fallback used
// before that fetch resolves (or if the table is empty/unreachable).
export interface TierRateConfig {
  id: string;
  name: string;
  base: number;
  perKm: number;
  perMin: number;
  minFare: number;
  bookingFee: number;
  serviceFee: number;
}

export type TierId = 'standard' | 'comfort' | 'xl';

export type TierRatesTable = Record<TierId, TierRateConfig>;

export const TIER_RATES: TierRatesTable = {
  standard: { id: 'standard', name: 'Standard', base: 999,  perKm: 270, perMin: 24, minFare: 1995, bookingFee: 100, serviceFee: 0 },
  comfort:  { id: 'comfort',  name: 'Comfort',  base: 1425, perKm: 372, perMin: 30, minFare: 2565, bookingFee: 100, serviceFee: 0 },
  xl:       { id: 'xl',       name: 'XL',       base: 1710, perKm: 429, perMin: 33, minFare: 2850, bookingFee: 100, serviceFee: 0 },
};

// Single source of truth for the platform's cut of every completed ride's fare.
// Was previously duplicated as the literal 0.2 / 0.8 in three places in
// lib/firebase-driver-service.ts — change it here only. The rate actually
// applied to a given ride is snapshotted onto the ride row at completion
// time (see calculateDriverPayout's `commissionRate` field and
// FirebaseDriverService.updateRideStatus), so changing this constant only
// affects rides completed AFTER the change — historical rows keep whatever
// rate was in effect when they were settled.
export const PLATFORM_COMMISSION_RATE = 0.1;
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
// 90/10 commission split (see calculateDriverPayout) — it's treated like any
// other fare, not driver-only compensation. Driver-side no-show/cancellation
// policy (compensating the rider) is out of scope for this pass.
export const CANCELLATION_FEE_CONFIG = {
  freeWindowSeconds: 60,
  afterAcceptFee: 200,
  afterArrivalFee: 500,
} as const;

// Post-trip driver tips. A tip is a separate, 100%-driver / 0%-platform
// transaction — never folded into fare/commission math (see
// calculateDriverPayout / rides_settle_trigger / create_tip). windowHours
// and min/maxAmount mirror the literals hardcoded in create_tip()
// (database/schemas/supabase-schema-tips.sql) — keep both in sync.
export const TIP_CONFIG = {
  presetAmounts: [100, 200, 500, 1000],
  minAmount: 50,
  maxAmount: 50000,
  windowHours: 72,
} as const;

export interface TipAmountConfig {
  minAmount: number;
  maxAmount: number;
}

export interface TipWindowConfig {
  windowHours: number;
}

export function isTipAmountValid(
  amount: number,
  config: TipAmountConfig = TIP_CONFIG
): boolean {
  return (
    Number.isFinite(amount) &&
    Number.isInteger(amount) &&
    amount >= config.minAmount &&
    amount <= config.maxAmount
  );
}

export function isTipWindowOpen(
  completedAt: string | Date | null | undefined,
  now: Date = new Date(),
  config: TipWindowConfig = TIP_CONFIG
): boolean {
  if (!completedAt) return false;
  const completed = typeof completedAt === 'string' ? new Date(completedAt) : completedAt;
  if (Number.isNaN(completed.getTime())) return false;
  const deadlineMs = completed.getTime() + config.windowHours * 60 * 60 * 1000;
  return now.getTime() <= deadlineMs;
}

// A tip's commission is always 0 — documented as a single, testable TS fact.
// create_tip() itself never computes a commission for a tip at all (not via
// a zero rate), so this exists purely as an explicit, assertable statement
// of the business rule for tests and any future display code.
export const TIP_COMMISSION_RATE = 0;
export function tipDriverPayout(amount: number): { commission: number; driverAmount: number } {
  const commission = amount * TIP_COMMISSION_RATE;
  return { commission, driverAmount: amount - commission };
}

// Flat "priority" add-on: rider pays extra for the ride to be sorted to the
// top of every online driver's request list (see mapRidesToRequests in
// firebase-driver-service.ts) instead of guaranteed faster matching — this
// is a pull-model marketplace broadcasting to all online drivers at once,
// so "priority" can only bias ordering, not promise a wait-time SLA.
// Default only; live value comes from `pricing_priority_config` (single row,
// same tunable-without-release pattern as TIER_RATES/surge_config).
export const PRIORITY_FEE_CONFIG = {
  fee: 500,
  isEnabled: true,
} as const;
