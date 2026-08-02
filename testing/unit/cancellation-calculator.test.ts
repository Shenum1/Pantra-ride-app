import { describe, expect, it } from 'vitest';
import { calculateCancellationFee } from '@/lib/cancellation-calculator';
import { CANCELLATION_FEE_CONFIG } from '@/lib/pricing-config';

describe('calculateCancellationFee', () => {
  it('is free when no driver has been assigned yet', () => {
    const result = calculateCancellationFee({ status: 'pending', acceptedAt: null, arrivedAt: null });
    expect(result.fee).toBe(0);
  });

  it('is free within the grace window after acceptance', () => {
    const now = new Date('2026-01-01T10:00:30Z'); // 30s after accept, window is 60s
    const result = calculateCancellationFee(
      { status: 'accepted', acceptedAt: '2026-01-01T10:00:00Z', arrivedAt: null },
      now
    );
    expect(result.fee).toBe(0);
  });

  it('charges the after-accept fee once the grace window has passed and the driver has not arrived', () => {
    const now = new Date('2026-01-01T10:05:00Z'); // 5 min after accept, well past the 60s window
    const result = calculateCancellationFee(
      { status: 'accepted', acceptedAt: '2026-01-01T10:00:00Z', arrivedAt: null },
      now
    );
    expect(result.fee).toBe(CANCELLATION_FEE_CONFIG.afterAcceptFee);
  });

  it('charges the higher after-arrival fee once the driver has arrived at pickup', () => {
    const now = new Date('2026-01-01T10:06:00Z');
    const result = calculateCancellationFee(
      { status: 'accepted', acceptedAt: '2026-01-01T10:00:00Z', arrivedAt: '2026-01-01T10:04:00Z' },
      now
    );
    expect(result.fee).toBe(CANCELLATION_FEE_CONFIG.afterArrivalFee);
    expect(result.fee).toBeGreaterThan(CANCELLATION_FEE_CONFIG.afterAcceptFee);
  });

  it('is exactly free at the boundary of the grace window', () => {
    const now = new Date('2026-01-01T10:01:00Z'); // exactly 60s after accept
    const result = calculateCancellationFee(
      { status: 'accepted', acceptedAt: '2026-01-01T10:00:00Z', arrivedAt: null },
      now
    );
    expect(result.fee).toBe(0);
  });

  it('accepts Date objects as well as ISO strings', () => {
    const acceptedAt = new Date('2026-01-01T10:00:00Z');
    const now = new Date('2026-01-01T10:05:00Z');
    const result = calculateCancellationFee({ status: 'accepted', acceptedAt, arrivedAt: null }, now);
    expect(result.fee).toBe(CANCELLATION_FEE_CONFIG.afterAcceptFee);
  });
});
