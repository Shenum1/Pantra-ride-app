import { describe, expect, it } from 'vitest';
import {
  calculateFare,
  calculateFareBreakdown,
  calculateAllTierFares,
  clampToMinFare,
  applyRideDiscounts,
  calculateDriverPayout,
  calculateWaitingCharge,
  getOfferPresets,
  validateOfferedFare,
} from '@/lib/fare-calculator';
import { TIER_RATES, PLATFORM_COMMISSION_RATE, DRIVER_PAYOUT_RATE, SHARED_RIDE_DISCOUNT_MULTIPLIER, ZONE_FEES, WAITING_CHARGE_CONFIG } from '@/lib/pricing-config';

describe('calculateFareBreakdown — core meter math (backward compatible)', () => {
  it('computes base/distance/time exactly as before, unaffected by fees or reordering', () => {
    const breakdown = calculateFareBreakdown(5, 15, 'standard');
    expect(breakdown.base).toBe(TIER_RATES.standard.base);
    expect(breakdown.distanceCost).toBe(TIER_RATES.standard.perKm * 5);
    expect(breakdown.timeCost).toBe(TIER_RATES.standard.perMin * 15);
    // base 333 + (90*5) + (8*15) = 903, above the 665 minimum
    expect(breakdown.meteredSubtotal).toBe(903);
    expect(breakdown.minFareApplied).toBe(false);
  });

  it('adds the configured booking fee on top of the metered subtotal', () => {
    const breakdown = calculateFareBreakdown(5, 15, 'standard');
    expect(breakdown.bookingFee).toBe(100);
    expect(breakdown.serviceFee).toBe(0);
    expect(breakdown.total).toBe(breakdown.meteredSubtotal + 100);
  });

  it('applies the minimum fare BEFORE surge (order matters)', () => {
    // raw metered = 333 + (90*0.2) + (8*1) = 359, below the 665 minimum
    const surged = calculateFareBreakdown(0.2, 1, 'standard', 2);
    // New order: floor to 665 first, THEN surge -> 665 * 2 = 1330
    expect(surged.meteredSubtotal).toBe(1330);

    // Sanity check against the old (surge-then-floor) order, which would have
    // given 359 * 2 = 718, then floored to max(718, 665) = 718 — a different,
    // lower number. Confirms the new order is actually in effect.
    const oldOrderResult = Math.max(Math.round(359 * 2), TIER_RATES.standard.minFare);
    expect(surged.meteredSubtotal).not.toBe(oldOrderResult);
  });

  it('never surges the flat booking/service fees', () => {
    const noSurge = calculateFareBreakdown(5, 15, 'standard', 1);
    const heavySurge = calculateFareBreakdown(5, 15, 'standard', 3);
    expect(noSurge.bookingFee).toBe(100);
    expect(heavySurge.bookingFee).toBe(100);
    expect(heavySurge.meteredSubtotal).toBe(noSurge.meteredSubtotal * 3);
  });

  it('falls back to standard rates for an unknown tier id', () => {
    expect(calculateFareBreakdown(5, 15, 'unknown-tier')).toEqual(calculateFareBreakdown(5, 15, 'standard'));
  });
});

describe('calculateFare', () => {
  it('returns the fee-inclusive total (the tier "sticker price" before any rider discount)', () => {
    expect(calculateFare(5, 15, 'standard')).toBe(1003); // 903 metered + 100 booking fee
  });

  it('clips to the tier minimum fare on a very short trip', () => {
    const fare = calculateFare(0.2, 1, 'standard');
    expect(fare).toBe(TIER_RATES.standard.minFare + TIER_RATES.standard.bookingFee);
  });
});

describe('calculateAllTierFares', () => {
  it('returns a fare for every tier, consistent with calculateFare', () => {
    const fares = calculateAllTierFares(5, 15);
    expect(fares.standard).toBe(calculateFare(5, 15, 'standard'));
    expect(fares.comfort).toBe(calculateFare(5, 15, 'comfort'));
    expect(fares.xl).toBe(calculateFare(5, 15, 'xl'));
  });
});

describe('clampToMinFare', () => {
  it('leaves a price above the minimum untouched', () => {
    expect(clampToMinFare(2000, 'standard')).toBe(2000);
  });

  it('raises a price below the minimum up to the floor', () => {
    expect(clampToMinFare(100, 'standard')).toBe(TIER_RATES.standard.minFare);
  });

  it('uses the correct tier-specific floor', () => {
    expect(clampToMinFare(100, 'xl')).toBe(TIER_RATES.xl.minFare);
  });
});

describe('applyRideDiscounts — operates on the metered fare only', () => {
  it('passes a price through unchanged when there are no discounts', () => {
    expect(applyRideDiscounts(2000, 'standard', {})).toBe(2000);
  });

  it('applies the shared-ride discount', () => {
    const discounted = applyRideDiscounts(1000, 'standard', {
      sharedRideDiscountMultiplier: SHARED_RIDE_DISCOUNT_MULTIPLIER,
    });
    expect(discounted).toBe(800);
  });

  it('applies a promo discount, capped by maxDiscountNGN', () => {
    const discounted = applyRideDiscounts(1000, 'standard', {
      promo: { discountPercentage: 50, maxDiscountNGN: 200 },
    });
    expect(discounted).toBe(800); // 1000 - min(500, 200)
  });

  it('applies a promo discount uncapped when maxDiscountNGN is not set', () => {
    const discounted = applyRideDiscounts(1000, 'standard', {
      promo: { discountPercentage: 10 },
    });
    expect(discounted).toBe(900);
  });

  it('never drops the discounted metered fare below the tier minimum, even when shared-ride + promo stack', () => {
    const discounted = applyRideDiscounts(1000, 'standard', {
      sharedRideDiscountMultiplier: SHARED_RIDE_DISCOUNT_MULTIPLIER,
      promo: { discountPercentage: 50 },
    });
    // 1000 -> 800 (shared) -> 400 (50% promo) -> floored to the 665 minimum
    expect(discounted).toBe(TIER_RATES.standard.minFare);
  });
});

describe('discounts never reduce platform-owned fees (full pipeline)', () => {
  it('booking fee survives in full even under a maximal shared-ride + promo discount', () => {
    const breakdown = calculateFareBreakdown(5, 15, 'standard'); // meteredSubtotal 903, bookingFee 100

    const discountedMetered = applyRideDiscounts(breakdown.meteredSubtotal, 'standard', {
      sharedRideDiscountMultiplier: SHARED_RIDE_DISCOUNT_MULTIPLIER,
      promo: { discountPercentage: 50 },
    });
    const finalTotal = discountedMetered + breakdown.bookingFee + breakdown.serviceFee;

    // The discount crushed the metered portion down to the floor...
    expect(discountedMetered).toBe(TIER_RATES.standard.minFare);
    expect(discountedMetered).toBeLessThan(breakdown.meteredSubtotal);
    // ...but the booking fee is still charged in full, untouched by the discount.
    expect(finalTotal - discountedMetered).toBe(100);
    expect(finalTotal).toBe(TIER_RATES.standard.minFare + 100);
  });

  it('booking fee is identical whether or not any discount is applied', () => {
    const breakdown = calculateFareBreakdown(5, 15, 'comfort');

    const withNoDiscount = applyRideDiscounts(breakdown.meteredSubtotal, 'comfort', {});
    const withHeavyDiscount = applyRideDiscounts(breakdown.meteredSubtotal, 'comfort', {
      sharedRideDiscountMultiplier: SHARED_RIDE_DISCOUNT_MULTIPLIER,
      promo: { discountPercentage: 90 },
    });

    expect(withNoDiscount + breakdown.bookingFee).toBe(breakdown.meteredSubtotal + 100);
    expect(withHeavyDiscount + breakdown.bookingFee).toBe(TIER_RATES.comfort.minFare + 100);
    // Regardless of how much the metered portion was discounted, the fee
    // contribution to the final total is always exactly 100.
    expect(breakdown.bookingFee).toBe(100);
  });
});

describe('commission constants', () => {
  it('platform commission and driver payout sum to the whole fare', () => {
    expect(PLATFORM_COMMISSION_RATE + DRIVER_PAYOUT_RATE).toBe(1);
  });

  it('matches the previously-hardcoded 20% commission / 80% payout split', () => {
    expect(PLATFORM_COMMISSION_RATE).toBe(0.2);
    expect(DRIVER_PAYOUT_RATE).toBe(0.8);
  });
});

describe('calculateDriverPayout', () => {
  it('matches the old flat 80/20 split when there are no fees (backward compatible)', () => {
    const { meteredFare, commission, netAmount } = calculateDriverPayout(1000);
    expect(meteredFare).toBe(1000);
    expect(commission).toBe(200);
    expect(netAmount).toBe(800);
  });

  it('applies commission only to the metered portion, never to fees', () => {
    // fare = 1000 metered + 100 bookingFee + 50 serviceFee = 1150 total
    const { meteredFare, commission, netAmount } = calculateDriverPayout(1150, 100, 50);
    expect(meteredFare).toBe(1000);
    expect(commission).toBe(200); // 20% of the 1000 metered portion only
    expect(netAmount).toBe(950);  // driver keeps 800 metered + both fees in full
  });

  it('never returns a negative metered fare', () => {
    const { meteredFare } = calculateDriverPayout(100, 80, 80);
    expect(meteredFare).toBe(0);
  });

  it('end-to-end: a ride booked with the current ₦100 booking fee pays the driver correctly', () => {
    const breakdown = calculateFareBreakdown(5, 15, 'standard'); // meteredSubtotal 903, bookingFee 100
    const finalFare = breakdown.meteredSubtotal + breakdown.bookingFee + breakdown.serviceFee; // 1003

    const { commission, netAmount } = calculateDriverPayout(finalFare, breakdown.bookingFee, breakdown.serviceFee);
    expect(commission).toBe(903 * PLATFORM_COMMISSION_RATE); // commission on the metered 903 only, not on 1003
    expect(netAmount).toBe(finalFare - commission); // driver gets everything else, including the full booking fee
  });

  it('excludes zoneFee from the commission base too', () => {
    // 1000 metered + 100 booking + 500 zone (e.g. airport pickup) = 1600 total
    const { meteredFare, commission, netAmount } = calculateDriverPayout(1600, 100, 0, 500);
    expect(meteredFare).toBe(1000);
    expect(commission).toBe(200); // 20% of the 1000 metered portion only
    expect(netAmount).toBe(1400); // driver keeps 800 metered + booking fee + zone fee in full
  });
});

describe('zoneFee — flat, platform-owned, same treatment as bookingFee/serviceFee', () => {
  it('defaults to 0 when not provided (backward compatible)', () => {
    const breakdown = calculateFareBreakdown(5, 15, 'standard');
    expect(breakdown.zoneFee).toBe(0);
    expect(breakdown.total).toBe(breakdown.meteredSubtotal + breakdown.bookingFee);
  });

  it('is added to the total on top of the other fees', () => {
    const breakdown = calculateFareBreakdown(5, 15, 'standard', 1, ZONE_FEES.airportPickup);
    expect(breakdown.zoneFee).toBe(500);
    expect(breakdown.total).toBe(breakdown.meteredSubtotal + breakdown.bookingFee + 500);
  });

  it('is never surged', () => {
    const breakdown = calculateFareBreakdown(5, 15, 'standard', 3, ZONE_FEES.airportPickup);
    expect(breakdown.zoneFee).toBe(500);
  });

  it('is excluded from rider discounts, same as booking/service fee', () => {
    const breakdown = calculateFareBreakdown(5, 15, 'standard', 1, ZONE_FEES.airportPickup);
    const discountedMetered = applyRideDiscounts(breakdown.meteredSubtotal, 'standard', {
      sharedRideDiscountMultiplier: SHARED_RIDE_DISCOUNT_MULTIPLIER,
      promo: { discountPercentage: 50 },
    });
    const finalTotal = discountedMetered + breakdown.bookingFee + breakdown.serviceFee + breakdown.zoneFee;
    expect(finalTotal - discountedMetered).toBe(breakdown.bookingFee + breakdown.zoneFee);
    expect(breakdown.zoneFee).toBe(500);
  });
});

describe('calculateWaitingCharge', () => {
  it('is 0 when arrivedAt or startedAt is missing', () => {
    expect(calculateWaitingCharge(null, new Date())).toBe(0);
    expect(calculateWaitingCharge(new Date(), null)).toBe(0);
    expect(calculateWaitingCharge(undefined, undefined)).toBe(0);
  });

  it('is 0 within the grace period', () => {
    const arrivedAt = new Date('2026-01-01T10:00:00Z');
    const startedAt = new Date('2026-01-01T10:03:00Z'); // exactly at the 3-minute grace boundary
    expect(calculateWaitingCharge(arrivedAt, startedAt)).toBe(0);
  });

  it('charges per minute only for time beyond the grace period', () => {
    const arrivedAt = new Date('2026-01-01T10:00:00Z');
    const startedAt = new Date('2026-01-01T10:08:00Z'); // 8 minutes waited, 3 free -> 5 chargeable
    expect(calculateWaitingCharge(arrivedAt, startedAt)).toBe(5 * WAITING_CHARGE_CONFIG.perMinuteRate);
  });

  it('never charges negative (started before arrived, e.g. clock skew)', () => {
    const arrivedAt = new Date('2026-01-01T10:05:00Z');
    const startedAt = new Date('2026-01-01T10:00:00Z');
    expect(calculateWaitingCharge(arrivedAt, startedAt)).toBe(0);
  });
});

describe('waiting charge is excluded from commission, same mechanism as platform fees', () => {
  it('driver keeps the waiting charge in full', () => {
    // 1000 metered + 100 booking fee + 200 waiting charge = 1300 total
    const { meteredFare, commission, netAmount } = calculateDriverPayout(1300, 100, 0, 0, 200);
    expect(meteredFare).toBe(1000);
    expect(commission).toBe(200); // 20% of the 1000 metered portion only
    expect(netAmount).toBe(1100); // driver keeps 800 metered + booking fee + all of the waiting charge
  });

  it('backward compatible: defaults to 0 and matches the old payout when omitted', () => {
    const withDefault = calculateDriverPayout(1000, 100);
    const withExplicitZero = calculateDriverPayout(1000, 100, 0, 0, 0);
    expect(withDefault).toEqual(withExplicitZero);
  });
});

describe('cancellation fees get the NORMAL 80/20 split, unlike the other fees', () => {
  it('a cancelled ride\'s fare (== the cancellation fee) is commissioned like any other fare', () => {
    // A cancelled ride has fare == cancellationFee, no other fees involved.
    const { meteredFare, commission, netAmount } = calculateDriverPayout(200);
    expect(meteredFare).toBe(200); // the whole cancellation fee counts as "metered" for commission purposes
    expect(commission).toBe(40);   // normal 20%
    expect(netAmount).toBe(160);   // driver gets the normal 80%
  });
});

describe('getOfferPresets', () => {
  it('returns the 5 preset percentages relative to the metered fare', () => {
    const presets = getOfferPresets(1000, 'standard');
    expect(presets.map((p) => p.percent)).toEqual([-20, -10, 0, 10, 20]);
    expect(presets.map((p) => p.amount)).toEqual([800, 900, 1000, 1100, 1200]);
  });

  it('floor-guards presets that would fall below the tier minimum', () => {
    // -20% of 700 = 560, below standard's 665 minFare -> clamped up to 665
    const presets = getOfferPresets(700, 'standard');
    const minus20 = presets.find((p) => p.percent === -20)!;
    expect(minus20.amount).toBe(TIER_RATES.standard.minFare);
  });
});

describe('validateOfferedFare', () => {
  it('accepts a reasonable offer within range', () => {
    expect(validateOfferedFare(1000, 900, 'standard')).toEqual({ valid: true });
  });

  it('rejects an offer below the tier minimum fare', () => {
    const result = validateOfferedFare(1000, 100, 'standard');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain(String(TIER_RATES.standard.minFare));
  });

  it('rejects an unreasonably high offer', () => {
    const result = validateOfferedFare(1000, 5000, 'standard');
    expect(result.valid).toBe(false);
  });

  it('rejects zero, negative, or non-finite amounts', () => {
    expect(validateOfferedFare(1000, 0, 'standard').valid).toBe(false);
    expect(validateOfferedFare(1000, -50, 'standard').valid).toBe(false);
    expect(validateOfferedFare(1000, NaN, 'standard').valid).toBe(false);
  });
});
