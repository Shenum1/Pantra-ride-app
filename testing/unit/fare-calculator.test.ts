import { describe, expect, it } from 'vitest';
import {
  calculateFare,
  calculateFareBreakdown,
  calculateAllTierFares,
  clampToMinFare,
  applyRideDiscounts,
  calculateDriverPayout,
  calculateWaitingCharge,
} from '@/lib/fare-calculator';
import { TIER_RATES, PLATFORM_COMMISSION_RATE, DRIVER_PAYOUT_RATE, SHARED_RIDE_DISCOUNT_MULTIPLIER, ZONE_FEES, WAITING_CHARGE_CONFIG } from '@/lib/pricing-config';

describe('calculateFareBreakdown — core meter math (backward compatible)', () => {
  it('computes base/distance/time exactly as before, unaffected by fees or reordering', () => {
    const breakdown = calculateFareBreakdown(5, 15, 'standard');
    expect(breakdown.base).toBe(TIER_RATES.standard.base);
    expect(breakdown.distanceCost).toBe(TIER_RATES.standard.perKm * 5);
    expect(breakdown.timeCost).toBe(TIER_RATES.standard.perMin * 15);
    // base 999 + (270*5) + (24*15) = 2709, above the 1995 minimum
    expect(breakdown.meteredSubtotal).toBe(2709);
    expect(breakdown.minFareApplied).toBe(false);
  });

  it('adds the configured booking fee on top of the metered subtotal', () => {
    const breakdown = calculateFareBreakdown(5, 15, 'standard');
    expect(breakdown.bookingFee).toBe(100);
    expect(breakdown.serviceFee).toBe(0);
    expect(breakdown.total).toBe(breakdown.meteredSubtotal + 100);
  });

  it('applies the minimum fare BEFORE surge (order matters)', () => {
    // raw metered = 999 + (270*0.2) + (24*1) = 1077, below the 1995 minimum
    const surged = calculateFareBreakdown(0.2, 1, 'standard', 2);
    // New order: floor to 1995 first, THEN surge -> 1995 * 2 = 3990
    expect(surged.meteredSubtotal).toBe(3990);

    // Sanity check against the old (surge-then-floor) order, which would have
    // given 1077 * 2 = 2154, then floored to max(2154, 1995) = 2154 — a
    // different, lower number. Confirms the new order is actually in effect.
    const oldOrderResult = Math.max(Math.round(1077 * 2), TIER_RATES.standard.minFare);
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
    expect(calculateFare(5, 15, 'standard')).toBe(2809); // 2709 metered + 100 booking fee
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
    // Base amount picked well above the tier minFare so the clamp doesn't
    // interfere — this test is about the discount math, not the floor.
    const discounted = applyRideDiscounts(5000, 'standard', {
      sharedRideDiscountMultiplier: SHARED_RIDE_DISCOUNT_MULTIPLIER,
    });
    expect(discounted).toBe(4000);
  });

  it('applies a promo discount, capped by maxDiscountNGN', () => {
    const discounted = applyRideDiscounts(5000, 'standard', {
      promo: { discountPercentage: 50, maxDiscountNGN: 200 },
    });
    expect(discounted).toBe(4800); // 5000 - min(2500, 200)
  });

  it('applies a promo discount uncapped when maxDiscountNGN is not set', () => {
    const discounted = applyRideDiscounts(5000, 'standard', {
      promo: { discountPercentage: 10 },
    });
    expect(discounted).toBe(4500);
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

  it('matches the target 10% commission / 90% driver payout split', () => {
    expect(PLATFORM_COMMISSION_RATE).toBe(0.1);
    expect(DRIVER_PAYOUT_RATE).toBe(0.9);
  });
});

describe('calculateDriverPayout', () => {
  it('matches the flat 90/10 split when there are no fees (backward compatible)', () => {
    const { meteredFare, commission, netAmount, commissionRate } = calculateDriverPayout(1000);
    expect(meteredFare).toBe(1000);
    expect(commission).toBe(100);
    expect(netAmount).toBe(900);
    expect(commissionRate).toBe(0.1);
  });

  it('applies commission only to the metered portion, never to fees', () => {
    // fare = 1000 metered + 100 bookingFee + 50 serviceFee = 1150 total
    const { meteredFare, commission, netAmount } = calculateDriverPayout(1150, 100, 50);
    expect(meteredFare).toBe(1000);
    expect(commission).toBe(100); // 10% of the 1000 metered portion only
    expect(netAmount).toBe(1050); // driver keeps 900 metered + both fees in full
  });

  it('never returns a negative metered fare', () => {
    const { meteredFare } = calculateDriverPayout(100, 80, 80);
    expect(meteredFare).toBe(0);
  });

  it('end-to-end: a ride booked with the current ₦100 booking fee pays the driver correctly', () => {
    const breakdown = calculateFareBreakdown(5, 15, 'standard'); // meteredSubtotal 2709, bookingFee 100
    const finalFare = breakdown.meteredSubtotal + breakdown.bookingFee + breakdown.serviceFee; // 2809

    const { commission, netAmount } = calculateDriverPayout(finalFare, breakdown.bookingFee, breakdown.serviceFee);
    expect(commission).toBe(breakdown.meteredSubtotal * PLATFORM_COMMISSION_RATE); // commission on the metered portion only, not on the fee-inclusive total
    expect(netAmount).toBe(finalFare - commission); // driver gets everything else, including the full booking fee
  });

  it('excludes zoneFee from the commission base too', () => {
    // 1000 metered + 100 booking + 500 zone (e.g. airport pickup) = 1600 total
    const { meteredFare, commission, netAmount } = calculateDriverPayout(1600, 100, 0, 500);
    expect(meteredFare).toBe(1000);
    expect(commission).toBe(100); // 10% of the 1000 metered portion only
    expect(netAmount).toBe(1500); // driver keeps 900 metered + booking fee + zone fee in full
  });

  it('platform commission + driver earnings always reconcile to the commissionable (metered) amount', () => {
    const cases: [number, number, number, number, number, number][] = [
      [5000, 0, 0, 0, 0, 0],       // plain fare, the ₦5,000 example from the spec
      [2809, 100, 0, 0, 0, 0],     // standard tier sticker price
      [7500, 100, 0, 500, 200, 500], // every fee type stacked at once
    ];
    for (const [fare, bookingFee, serviceFee, zoneFee, waitingCharge, priorityFee] of cases) {
      const { meteredFare, commission, netAmount } = calculateDriverPayout(
        fare, bookingFee, serviceFee, zoneFee, waitingCharge, priorityFee
      );
      const flatFees = bookingFee + serviceFee + zoneFee + waitingCharge + priorityFee;
      expect(commission + (netAmount - flatFees)).toBeCloseTo(meteredFare, 8);
    }
  });

  it('worked example from the spec: ₦5,000 fare splits into ₦500 platform / ₦4,500 driver', () => {
    const { commission, netAmount } = calculateDriverPayout(5000);
    expect(commission).toBe(500);
    expect(netAmount).toBe(4500);
  });

  it('surge is already folded into the fare by the time commission is computed: ₦7,500 (5,000 x 1.5 surge) splits 750/6,750', () => {
    const surgedFare = 5000 * 1.5;
    const { commission, netAmount } = calculateDriverPayout(surgedFare);
    expect(commission).toBe(750);
    expect(netAmount).toBe(6750);
  });

  it('shared-ride discount is already folded into the fare by the time commission is computed: ₦4,000 (5,000 x 0.8) splits 400/3,600', () => {
    const discountedFare = applyRideDiscounts(5000, 'standard', {
      sharedRideDiscountMultiplier: SHARED_RIDE_DISCOUNT_MULTIPLIER,
    });
    expect(discountedFare).toBe(4000);
    const { commission, netAmount } = calculateDriverPayout(discountedFare);
    expect(commission).toBe(400);
    expect(netAmount).toBe(3600);
  });

  it('commission is computed on the minimum fare, not the raw (pre-floor) metered amount', () => {
    const breakdown = calculateFareBreakdown(0.2, 1, 'standard'); // raw metered well below minFare
    expect(breakdown.minFareApplied).toBe(true);
    expect(breakdown.meteredSubtotal).toBe(TIER_RATES.standard.minFare);

    const { commission, netAmount } = calculateDriverPayout(breakdown.total, breakdown.bookingFee, breakdown.serviceFee);
    expect(commission).toBe(TIER_RATES.standard.minFare * PLATFORM_COMMISSION_RATE);
    expect(netAmount).toBe(breakdown.total - commission);
  });

  it('rounding: a fractional-kobo commission is not silently truncated to zero', () => {
    // 10% of 33 is 3.3 — a fare small enough that naive integer math could zero it out.
    const { commission, netAmount } = calculateDriverPayout(33);
    expect(commission).toBeCloseTo(3.3, 8);
    expect(netAmount).toBeCloseTo(29.7, 8);
    expect(commission + netAmount).toBeCloseTo(33, 8);
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

describe('trafficMultiplier — combines with surge, never surged/discounted itself', () => {
  it('defaults to 1 (no-op) when not provided (backward compatible)', () => {
    const breakdown = calculateFareBreakdown(5, 15, 'standard');
    expect(breakdown.trafficMultiplier).toBe(1);
  });

  it('multiplies together with surge on the metered subtotal', () => {
    const noMultiplier = calculateFareBreakdown(5, 15, 'standard', 1, 0, 1);
    const withTraffic = calculateFareBreakdown(5, 15, 'standard', 1, 0, 1.2);
    expect(withTraffic.meteredSubtotal).toBe(Math.round(noMultiplier.meteredSubtotal * 1.2));

    const withBoth = calculateFareBreakdown(5, 15, 'standard', 2, 0, 1.2);
    expect(withBoth.meteredSubtotal).toBe(Math.round(noMultiplier.meteredSubtotal * 2 * 1.2));
  });

  it('applies after the minimum-fare clamp, same as surge', () => {
    // raw metered 1077, floored to minFare 1995, then x1.2 traffic
    const breakdown = calculateFareBreakdown(0.2, 1, 'standard', 1, 0, 1.2);
    expect(breakdown.meteredSubtotal).toBe(Math.round(TIER_RATES.standard.minFare * 1.2));
  });
});

describe('priorityFee — flat, platform-owned, same treatment as bookingFee/zoneFee', () => {
  it('defaults to 0 when not provided (backward compatible)', () => {
    const breakdown = calculateFareBreakdown(5, 15, 'standard');
    expect(breakdown.priorityFee).toBe(0);
  });

  it('is added to the total on top of the other fees', () => {
    const breakdown = calculateFareBreakdown(5, 15, 'standard', 1, 0, 1, 500);
    expect(breakdown.priorityFee).toBe(500);
    expect(breakdown.total).toBe(breakdown.meteredSubtotal + breakdown.bookingFee + 500);
  });

  it('is never surged', () => {
    const breakdown = calculateFareBreakdown(5, 15, 'standard', 3, 0, 1, 500);
    expect(breakdown.priorityFee).toBe(500);
  });

  it('is excluded from the driver-payout commission base, like zoneFee', () => {
    // 1000 metered + 100 booking + 500 priority = 1600 total
    const { meteredFare, commission, netAmount } = calculateDriverPayout(1600, 100, 0, 0, 0, 500);
    expect(meteredFare).toBe(1000);
    expect(commission).toBe(100); // 10% of the 1000 metered portion only
    expect(netAmount).toBe(1500); // driver keeps 900 metered + booking fee + priority fee in full
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
    expect(commission).toBe(100); // 10% of the 1000 metered portion only
    expect(netAmount).toBe(1200); // driver keeps 900 metered + booking fee + all of the waiting charge
  });

  it('backward compatible: defaults to 0 and matches the old payout when omitted', () => {
    const withDefault = calculateDriverPayout(1000, 100);
    const withExplicitZero = calculateDriverPayout(1000, 100, 0, 0, 0);
    expect(withDefault).toEqual(withExplicitZero);
  });
});

describe('cancellation fees get the NORMAL 90/10 split, unlike the other fees', () => {
  it('a cancelled ride\'s fare (== the cancellation fee) is commissioned like any other fare', () => {
    // A cancelled ride has fare == cancellationFee, no other fees involved.
    const { meteredFare, commission, netAmount } = calculateDriverPayout(200);
    expect(meteredFare).toBe(200); // the whole cancellation fee counts as "metered" for commission purposes
    expect(commission).toBe(20);   // normal 10%
    expect(netAmount).toBe(180);   // driver gets the normal 90%
  });
});
