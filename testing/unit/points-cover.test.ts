import { describe, expect, it } from 'vitest';
import { calculatePointsCover, POINTS_MAX_FARE_SHARE, POINTS_TO_NGN } from '../../lib/points-config';

describe('points config', () => {
  it('uses the agreed rate and cap', () => {
    expect(POINTS_TO_NGN).toBe(16);
    expect(POINTS_MAX_FARE_SHARE).toBe(0.5);
  });
});

describe('calculatePointsCover', () => {
  it('covers nothing without points', () => {
    expect(calculatePointsCover(2000, 0)).toEqual({ pointsUsed: 0, valueNGN: 0 });
    expect(calculatePointsCover(2000, -50)).toEqual({ pointsUsed: 0, valueNGN: 0 });
  });

  it('covers nothing for a fare of zero or less', () => {
    expect(calculatePointsCover(0, 500)).toEqual({ pointsUsed: 0, valueNGN: 0 });
    expect(calculatePointsCover(-100, 500)).toEqual({ pointsUsed: 0, valueNGN: 0 });
  });

  it('uses the whole balance when it is below the cap', () => {
    // 50 points = ₦800, well under half of ₦2000
    expect(calculatePointsCover(2000, 50)).toEqual({ pointsUsed: 50, valueNGN: 800 });
  });

  it('never covers more than half the fare', () => {
    // half of ₦2000 = ₦1000 = 62.5 points → 62 whole points = ₦992
    expect(calculatePointsCover(2000, 10_000)).toEqual({ pointsUsed: 62, valueNGN: 992 });
  });

  it('only ever uses whole points', () => {
    const { pointsUsed } = calculatePointsCover(1234.56, 9999);
    expect(Number.isInteger(pointsUsed)).toBe(true);
    expect(calculatePointsCover(2000, 10.9).pointsUsed).toBe(10);
  });

  it('handles fares with kobo', () => {
    // half of ₦1000.50 = ₦500.25 → 31 points (₦496), 32 would be ₦512
    expect(calculatePointsCover(1000.5, 1000)).toEqual({ pointsUsed: 31, valueNGN: 496 });
  });

  it('a tiny fare cannot be covered by a whole point', () => {
    // half of ₦20 = ₦10, less than one point (₦16)
    expect(calculatePointsCover(20, 500)).toEqual({ pointsUsed: 0, valueNGN: 0 });
  });

  it('property: value never exceeds the cap or the balance, and is a whole number of points', () => {
    for (let fare = 0; fare <= 20000; fare += 137.37) {
      for (const balance of [0, 1, 7, 62, 63, 500, 100000]) {
        const { pointsUsed, valueNGN } = calculatePointsCover(fare, balance);
        expect(valueNGN).toBe(pointsUsed * POINTS_TO_NGN);
        expect(pointsUsed).toBeLessThanOrEqual(balance);
        expect(valueNGN).toBeLessThanOrEqual(Math.max(0, fare) * POINTS_MAX_FARE_SHARE + 1e-9);
        // and it is the largest whole number of points that fits the cap
        if (pointsUsed < Math.floor(balance)) {
          expect((pointsUsed + 1) * POINTS_TO_NGN).toBeGreaterThan(fare * POINTS_MAX_FARE_SHARE - 1e-9);
        }
      }
    }
  });
});
