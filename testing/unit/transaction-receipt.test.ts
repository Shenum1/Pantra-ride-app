import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'ios' }, Share: { share: vi.fn() } }));
vi.mock('expo-print', () => ({ printAsync: vi.fn(), printToFileAsync: vi.fn() }));
vi.mock('expo-sharing', () => ({ isAvailableAsync: vi.fn(), shareAsync: vi.fn() }));

const { buildReceiptHtml, buildReceiptText, receiptRows } = await import('@/lib/transaction-receipt');

const topUp = {
  id: 'wt-123',
  type: 'add_money' as const,
  amount: 10000,
  description: 'Added money to wallet',
  status: 'completed' as const,
  date: new Date('2026-10-04T12:02:16Z'),
};

describe('transaction receipts', () => {
  it('lists the key details of a top-up', () => {
    const text = buildReceiptText(topUp);
    expect(text).toContain('Pantra receipt');
    expect(text).toContain('Type: Money Added');
    expect(text).toContain('Amount: +₦10,000.00');
    expect(text).toContain('Status: Completed');
    expect(text).toContain('Transaction ID: wt-123');
  });

  it('shows a ride payment as money out, with its trip details', () => {
    const rows = Object.fromEntries(
      receiptRows({
        ...topUp,
        type: 'ride_payment',
        amount: -3500,
        rideId: 'ride-9',
        metadata: { fromLocation: 'Ikeja', toLocation: 'Lekki', rideFare: 3500 },
      })
    );
    expect(rows['Amount']).toBe('-₦3,500.00');
    expect(rows['Ride ID']).toBe('ride-9');
    expect(rows['From']).toBe('Ikeja');
    expect(rows['To']).toBe('Lekki');
  });

  it('escapes stored text in the PDF, so an address can never inject markup', () => {
    const html = buildReceiptHtml({ ...topUp, metadata: { fromLocation: '<script>alert(1)</script> & "x"' } });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;');
  });
});
