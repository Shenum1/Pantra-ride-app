import { describe, expect, it } from 'vitest';
import {
  calculateFare,
  calculateFareBreakdown,
  calculateAllTierFares,
  clampToMinFare,
  applyRideDiscounts,
  calculateDriverPayout,
} from '@/lib/fare-calculator';
import { TIER_RATES, PLATFORM_COMMISSION_RATE, DRIVER_PAYOUT_RATE, SHARED_RIDE_DISCOUNT_MULTIPLIER } from '@/lib/pricing-config';

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
});
