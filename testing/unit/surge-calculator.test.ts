import { describe, expect, it } from 'vitest';
import { calculateSurgeMultiplier, SurgeConfig } from '@/lib/surge-calculator';

const config: SurgeConfig = {
  minMultiplier: 1.0,
  maxMultiplier: 2.5,
  highDemandRatio: 1.5,
  lowDemandRatio: 0.3,
  isEnabled: true,
};

describe('calculateSurgeMultiplier', () => {
  it('returns 1 when surge is disabled, regardless of demand', () => {
    expect(calculateSurgeMultiplier(1, 100, { ...config, isEnabled: false })).toBe(1);
  });

  it('returns the minimum multiplier at or below the low-demand ratio', () => {
    expect(calculateSurgeMultiplier(10, 3, config)).toBe(1.0); // ratio 0.3 == lowDemandRatio
    expect(calculateSurgeMultiplier(10, 1, config)).toBe(1.0); // ratio 0.1 < lowDemandRatio
  });

  it('returns the maximum multiplier at or above the high-demand ratio', () => {
    expect(calculateSurgeMultiplier(10, 15, config)).toBe(2.5); // ratio 1.5 == highDemandRatio
    expect(calculateSurgeMultiplier(10, 30, config)).toBe(2.5); // ratio 3.0 > highDemandRatio
  });

  it('interpolates linearly between the low and high demand ratios', () => {
    // ratio 0.9 is exactly halfway between 0.3 and 1.5 -> halfway between 1.0 and 2.5
    const result = calculateSurgeMultiplier(10, 9, config);
    expect(result).toBeCloseTo(1.75, 2);
  });

  it('treats zero online drivers with pending rides as maximum demand', () => {
    expect(calculateSurgeMultiplier(0, 5, config)).toBe(2.5);
  });

  it('treats zero online drivers with no pending rides as no surge', () => {
    expect(calculateSurgeMultiplier(0, 0, config)).toBe(1.0);
  });

  it('never returns a value outside [minMultiplier, maxMultiplier]', () => {
    for (const pendingRides of [0, 1, 5, 10, 50, 1000]) {
      const result = calculateSurgeMultiplier(4, pendingRides, config);
      expect(result).toBeGreaterThanOrEqual(config.minMultiplier);
      expect(result).toBeLessThanOrEqual(config.maxMultiplier);
    }
  });
});
