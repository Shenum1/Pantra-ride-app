import { describe, expect, it } from 'vitest';
import {
  buildRideReceipt,
  buildRideReceiptText,
  receiptTotalRows,
  RideReceipt,
  RideReceiptSource,
} from '@/lib/ride-receipt';

const ride: RideReceiptSource = {
  id: 'ride-1',
  status: 'completed',
  createdAt: '2026-10-09T09:00:00Z',
  completedAt: '2026-10-09T09:30:00Z',
  fare: 2000,
  bookingFee: 100,
  serviceFee: 100,
  paymentMethod: 'wallet',
  paymentStatus: 'paid',
  pointsUsed: 62,
  pointsValueNGN: '992',
};

// These rides all have a receipt; the null case (no receipt) is tested in ride-receipt.test.ts.
function receiptFor(
  source: RideReceiptSource,
  perspective: 'rider' | 'driver',
  tip = 0
): RideReceipt {
  const receipt = buildRideReceipt(source, perspective, {}, tip);
  if (!receipt) throw new Error('expected a receipt');
  return receipt;
}

describe('receipts for rides paid partly with points', () => {
  it('rider: shows the points part, and what they actually paid', () => {
    expect(receiptTotalRows(receiptFor(ride, 'rider'))).toEqual([
      ['Total', '₦2,000.00'],
      ['Paid with points (62 pts)', '-₦992.00'],
      ['You paid', '₦1,008.00'],
    ]);
  });

  it('rider: a tip is added to what they paid, not to the full fare', () => {
    const rows = receiptTotalRows(receiptFor(ride, 'rider', 200));
    expect(rows[rows.length - 1]).toEqual(['Total incl. tip', '₦1,208.00']);
  });

  it('driver: sees the points part but no "You paid" line', () => {
    const labels = receiptTotalRows(receiptFor(ride, 'driver')).map(([label]) => label);
    expect(labels).toContain('Paid with points (62 pts)');
    expect(labels).not.toContain('You paid');
  });

  it('a ride without points is unchanged', () => {
    const plain = receiptFor({ ...ride, pointsUsed: 0, pointsValueNGN: 0 }, 'rider');
    expect(plain.pointsPaid).toBe(0);
    expect(receiptTotalRows(plain)).toEqual([['Total', '₦2,000.00']]);
  });

  it('points never exceed the total', () => {
    expect(receiptFor({ ...ride, pointsValueNGN: 99999 }, 'rider').pointsPaid).toBe(2000);
  });

  it('a cancellation receipt never shows points', () => {
    const cancelled = receiptFor(
      { ...ride, status: 'cancelled', cancellationFee: 200, cancelledAt: '2026-10-09T09:05:00Z' },
      'rider'
    );
    expect(cancelled.pointsPaid).toBe(0);
  });

  it('the text receipt includes the points line', () => {
    expect(buildRideReceiptText(receiptFor(ride, 'rider'))).toContain('Paid with points (62 pts)');
  });
});
