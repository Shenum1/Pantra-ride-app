import { describe, expect, it } from 'vitest';
import { TIP_CONFIG, isTipAmountValid, isTipWindowOpen, tipDriverPayout } from '@/lib/pricing-config';

describe('isTipAmountValid', () => {
  it('rejects zero', () => {
    expect(isTipAmountValid(0)).toBe(false);
  });

  it('rejects negative amounts', () => {
    expect(isTipAmountValid(-100)).toBe(false);
  });

  it('rejects decimal amounts', () => {
    expect(isTipAmountValid(100.5)).toBe(false);
  });

  it('rejects NaN and Infinity', () => {
    expect(isTipAmountValid(NaN)).toBe(false);
    expect(isTipAmountValid(Infinity)).toBe(false);
    expect(isTipAmountValid(-Infinity)).toBe(false);
  });

  it('rejects amounts below the configured minimum', () => {
    expect(isTipAmountValid(TIP_CONFIG.minAmount - 1)).toBe(false);
  });

  it('rejects amounts above the configured maximum', () => {
    expect(isTipAmountValid(TIP_CONFIG.maxAmount + 1)).toBe(false);
  });

  it('accepts the configured minimum and maximum exactly', () => {
    expect(isTipAmountValid(TIP_CONFIG.minAmount)).toBe(true);
    expect(isTipAmountValid(TIP_CONFIG.maxAmount)).toBe(true);
  });

  it('accepts every preset amount', () => {
    for (const amount of TIP_CONFIG.presetAmounts) {
      expect(isTipAmountValid(amount)).toBe(true);
    }
  });

  it('respects a custom config override', () => {
    expect(isTipAmountValid(5, { minAmount: 10, maxAmount: 20 })).toBe(false);
    expect(isTipAmountValid(15, { minAmount: 10, maxAmount: 20 })).toBe(true);
  });
});

describe('isTipWindowOpen', () => {
  const now = new Date('2026-01-10T12:00:00.000Z');

  it('returns false for a null/undefined completedAt', () => {
    expect(isTipWindowOpen(null, now)).toBe(false);
    expect(isTipWindowOpen(undefined, now)).toBe(false);
  });

  it('returns false for an unparseable date string', () => {
    expect(isTipWindowOpen('not-a-date', now)).toBe(false);
  });

  it('is true well within the window', () => {
    const completedAt = new Date(now.getTime() - 60 * 60 * 1000); // 1h ago
    expect(isTipWindowOpen(completedAt, now)).toBe(true);
  });

  it('is true exactly at the boundary', () => {
    const completedAt = new Date(now.getTime() - TIP_CONFIG.windowHours * 60 * 60 * 1000);
    expect(isTipWindowOpen(completedAt, now)).toBe(true);
  });

  it('is false one second past the boundary', () => {
    const completedAt = new Date(now.getTime() - TIP_CONFIG.windowHours * 60 * 60 * 1000 - 1000);
    expect(isTipWindowOpen(completedAt, now)).toBe(false);
  });

  it('accepts an ISO string the same as a Date', () => {
    const completedAt = new Date(now.getTime() - 60 * 60 * 1000);
    expect(isTipWindowOpen(completedAt.toISOString(), now)).toBe(true);
  });
});

describe('tipDriverPayout — commission is always 0', () => {
  it('returns the full amount to the driver with zero commission, across a range of amounts', () => {
    for (const amount of [50, 100, 200, 500, 1000, 12345, 50000]) {
      const { commission, driverAmount } = tipDriverPayout(amount);
      expect(commission).toBe(0);
      expect(driverAmount).toBe(amount);
    }
  });
});
