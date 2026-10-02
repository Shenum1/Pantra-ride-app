import { describe, expect, it, vi } from 'vitest';
import { resolveRidePaymentMethod } from '@/backend/trpc/routes/rides/create/route';

const WALLET_ROW_ID = '11111111-1111-4111-8111-111111111111';
const CASH_ROW_ID = '22222222-2222-4222-8222-222222222222';
const CARD_ROW_ID = '33333333-3333-4333-8333-333333333333';
const SOMEONE_ELSES_ROW_ID = '44444444-4444-4444-8444-444444444444';

const ownSavedMethods: Record<string, string> = {
  [WALLET_ROW_ID]: 'wallet',
  [CASH_ROW_ID]: 'cash',
  [CARD_ROW_ID]: 'card',
};
const lookup = async (id: string) => ownSavedMethods[id] ?? null;

describe('resolveRidePaymentMethod — rides.paymentMethod is always plain cash/wallet', () => {
  it('turns the rider\'s saved "Cash" / "Pantra Wallet" rows into the plain method', async () => {
    expect(await resolveRidePaymentMethod(CASH_ROW_ID, lookup)).toBe('cash');
    expect(await resolveRidePaymentMethod(WALLET_ROW_ID, lookup)).toBe('wallet');
  });

  it('passes plain values through without a lookup', async () => {
    const spy = vi.fn(lookup);
    expect(await resolveRidePaymentMethod('cash', spy)).toBe('cash');
    expect(await resolveRidePaymentMethod('Wallet', spy)).toBe('wallet');
    expect(spy).not.toHaveBeenCalled();
  });

  it('a legacy card row is a cash ride (card charging was never built)', async () => {
    expect(await resolveRidePaymentMethod(CARD_ROW_ID, lookup)).toBe('cash');
  });

  it("another rider's saved wallet can never be selected — it resolves as not found, so cash", async () => {
    expect(await resolveRidePaymentMethod(SOMEONE_ELSES_ROW_ID, lookup)).toBe('cash');
  });

  it('anything unrecognized is a cash ride, never stored as-is', async () => {
    expect(await resolveRidePaymentMethod('payment-1700000000000', lookup)).toBe('cash');
    expect(await resolveRidePaymentMethod('flutterwave', lookup)).toBe('cash');
    expect(await resolveRidePaymentMethod('', lookup)).toBe('cash');
  });

  it('a failed lookup throws rather than silently guessing cash', async () => {
    await expect(
      resolveRidePaymentMethod(WALLET_ROW_ID, async () => {
        throw new Error('db unavailable');
      })
    ).rejects.toThrow('db unavailable');
  });
});
