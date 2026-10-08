import { describe, expect, it } from 'vitest';
import {
  buildRideReceipt,
  buildRideReceiptHtml,
  buildRideReceiptText,
  isRideReceiptAvailable,
  receiptTotalRows,
  RideReceiptSource,
} from '@/lib/ride-receipt';

// Shaped like a real rides row written by rides.create: fare is the final
// total, fees are stored separately, numeric columns may arrive as strings.
const completedRide: RideReceiptSource = {
  id: 'ride-123',
  status: 'completed',
  createdAt: '2026-10-04T11:30:00Z',
  completedAt: '2026-10-04T12:02:16Z',
  pickupAddress: 'Ikeja City Mall',
  dropoffAddress: 'Murtala Muhammed Airport',
  rideType: 'comfort',
  fare: 6150,
  baseFare: 500,
  bookingFee: 200,
  serviceFee: '150',
  zoneFee: 1000,
  priorityFee: 0,
  waitingCharge: 300,
  cancellationFee: 0,
  promoCode: 'WELCOME10',
  paymentMethod: 'wallet',
  paymentStatus: 'paid',
  platformCommissionAmount: 450,
  driverEarningsAmount: 5700,
};

const charges = (r: ReturnType<typeof buildRideReceipt>) =>
  Object.fromEntries((r?.charges ?? []).map((c) => [c.label, c.amount]));
const details = (r: ReturnType<typeof buildRideReceipt>) => Object.fromEntries(r?.details ?? []);
const totals = (r: ReturnType<typeof buildRideReceipt>) => Object.fromEntries(r ? receiptTotalRows(r) : []);

describe('isRideReceiptAvailable', () => {
  it('is available for completed rides and fee-charging cancellations only', () => {
    expect(isRideReceiptAvailable({ status: 'completed' })).toBe(true);
    expect(isRideReceiptAvailable({ status: 'cancelled', cancellationFee: 500 })).toBe(true);
    expect(isRideReceiptAvailable({ status: 'cancelled', cancellationFee: 0 })).toBe(false);
    expect(isRideReceiptAvailable({ status: 'cancelled' })).toBe(false);
    expect(isRideReceiptAvailable({ status: 'in-progress' })).toBe(false);
  });

  it('builds nothing for a ride without a receipt', () => {
    expect(buildRideReceipt({ id: 'r', status: 'pending', fare: 1000 }, 'rider')).toBeNull();
  });
});

describe('buildRideReceipt — completed ride', () => {
  it('itemises the stored fees and derives trip fare as total minus fees', () => {
    const r = buildRideReceipt(completedRide, 'rider');
    expect(r?.kind).toBe('trip');
    expect(r?.total).toBe(6150);
    expect(charges(r)).toEqual({
      'Trip fare': 4500, // 6150 - (200 + 150 + 1000 + 300)
      'Booking fee': 200,
      'Service fee': 150,
      'Airport zone fee': 1000,
      'Waiting charge': 300,
    });
    // Zero fees are left off rather than shown as ₦0.00.
    expect(charges(r)).not.toHaveProperty('Priority fee');
    const tripFare = r?.charges.find((c) => c.label === 'Trip fare');
    expect(tripFare?.note).toContain('₦500.00 base fare');
    expect(tripFare?.note).toContain('promo WELCOME10 applied');
  });

  it('shows the driver first name and plate on the rider receipt, never the rider', () => {
    const r = buildRideReceipt(completedRide, 'rider', { driverName: 'Chinedu Okafor', vehiclePlate: ' LAG-123-XY ', riderName: 'Ada Obi' });
    const d = details(r);
    expect(d['Driver']).toBe('Chinedu');
    expect(d['Vehicle plate']).toBe('LAG-123-XY');
    expect(d).not.toHaveProperty('Rider');
    expect(d['Ride type']).toBe('Comfort');
    expect(d['Payment method']).toBe('Pantra Wallet');
    expect(d['Payment status']).toBe('Paid');
    expect(d['Pickup']).toBe('Ikeja City Mall');
    expect(d['Destination']).toBe('Murtala Muhammed Airport');
    expect(d['Ride ID']).toBe('ride-123');
  });

  it('shows the rider first name on the driver receipt, plus the commission split', () => {
    const r = buildRideReceipt(completedRide, 'driver', { driverName: 'Chinedu Okafor', riderName: 'Ada Obi' });
    const d = details(r);
    expect(d['Rider']).toBe('Ada');
    expect(d).not.toHaveProperty('Driver');
    expect(totals(r)).toEqual({ Total: '₦6,150.00', 'Pantra commission': '-₦450.00', 'Your earnings': '₦5,700.00' });
  });

  it('never shows commission on a rider receipt', () => {
    const r = buildRideReceipt(completedRide, 'rider');
    expect(r?.commission).toBeNull();
    expect(totals(r)).toEqual({ Total: '₦6,150.00' });
  });

  it('adds a tip separately from the fare', () => {
    const rider = buildRideReceipt(completedRide, 'rider', {}, 500);
    expect(totals(rider)).toEqual({ Total: '₦6,150.00', Tip: '₦500.00', 'Total incl. tip': '₦6,650.00' });
    const driver = buildRideReceipt(completedRide, 'driver', {}, 500);
    expect(totals(driver)['Tip (100% yours)']).toBe('₦500.00');
    expect(totals(driver)['Your earnings']).toBe('₦6,200.00');
  });

  it('copes with an old row that predates the fee columns', () => {
    const r = buildRideReceipt({ id: 'old', status: 'completed', fare: 2500, paymentMethod: 'cash' }, 'rider');
    expect(charges(r)).toEqual({ 'Trip fare': 2500 });
    expect(details(r)['Payment method']).toBe('Cash');
    expect(details(r)).not.toHaveProperty('Payment status');
    expect(details(r)).not.toHaveProperty('Date');
  });
});

describe('buildRideReceipt — cancellation', () => {
  it('charges only the cancellation fee', () => {
    const r = buildRideReceipt(
      { ...completedRide, status: 'cancelled', fare: 700, cancellationFee: 700, cancelledAt: '2026-10-04T11:35:00Z' },
      'rider'
    );
    expect(r?.kind).toBe('cancellation');
    expect(r?.title).toBe('Cancellation receipt');
    expect(r?.total).toBe(700);
    expect(charges(r)).toEqual({ 'Cancellation fee': 700 });
    expect(totals(r)).toEqual({ 'Total charged': '₦700.00' });
  });
});

describe('receipt text and PDF', () => {
  it('lists the details and breakdown in the shareable text', () => {
    const text = buildRideReceiptText(buildRideReceipt(completedRide, 'rider', { driverName: 'Chinedu' })!);
    expect(text).toContain('Pantra trip receipt');
    expect(text).toContain('Ride ID: ride-123');
    expect(text).toContain('Driver: Chinedu');
    expect(text).toContain('Booking fee: ₦200.00');
    expect(text).toContain('Total: ₦6,150.00');
  });

  it('escapes stored text in the PDF, so an address can never inject markup', () => {
    const html = buildRideReceiptHtml(
      buildRideReceipt({ ...completedRide, pickupAddress: '<script>alert(1)</script> & "x"' }, 'rider')!
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;');
    expect(html).toContain('Pantra');
  });
});
