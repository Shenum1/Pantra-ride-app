import { describe, expect, it } from 'vitest';
import {
  adminSettlementAmountError,
  cashCommissionStatusFrom,
  recordCommissionSettlement,
} from '@/backend/lib/cash-commission';

describe('cashCommissionStatusFrom — the ₦5,000 cash-ride limit', () => {
  it('a driver in credit owes nothing and keeps cash rides', () => {
    expect(cashCommissionStatusFrom(3000, 5000)).toMatchObject({ amountOwed: 0, blocked: false });
  });

  it('owing up to exactly the limit keeps cash rides; anything over pauses them', () => {
    expect(cashCommissionStatusFrom(-4999.99, 5000)).toMatchObject({ amountOwed: 4999.99, blocked: false });
    expect(cashCommissionStatusFrom(-5000, 5000)).toMatchObject({ amountOwed: 5000, blocked: false });
    expect(cashCommissionStatusFrom(-5000.01, 5000)).toMatchObject({ amountOwed: 5000.01, blocked: true });
  });
});

describe('adminSettlementAmountError — an admin can never record more than is owed', () => {
  it('accepts a full or partial payment of what is owed', () => {
    expect(adminSettlementAmountError(6200, 6200)).toBeNull();
    expect(adminSettlementAmountError(1000, 6200)).toBeNull();
  });

  it('rejects an overpayment (a typo would otherwise become money Pantra pays out)', () => {
    expect(adminSettlementAmountError(62000, 6200)).toMatch(/more than this driver owes/);
  });

  it('rejects zero/negative amounts and drivers who owe nothing', () => {
    expect(adminSettlementAmountError(0, 6200)).toMatch(/greater than zero/);
    expect(adminSettlementAmountError(-5, 6200)).toMatch(/greater than zero/);
    expect(adminSettlementAmountError(100, 0)).toMatch(/doesn't owe/);
  });
});

describe('recordCommissionSettlement — idempotent on the payment reference', () => {
  const db = (error: { code?: string; message: string } | null) => {
    const inserts: any[] = [];
    return {
      inserts,
      client: { from: () => ({ insert: (row: any) => { inserts.push(row); return Promise.resolve({ error }); } }) } as any,
    };
  };
  const params = { driverId: 'driver-1', amount: 6200, reference: 'PANTRA-abc', reason: 'test' };

  it('records a settlement row', async () => {
    const { client, inserts } = db(null);
    expect(await recordCommissionSettlement(client, params)).toEqual({ recorded: true });
    expect(inserts[0]).toMatchObject({ type: 'cash_commission_settlement', amount: 6200, reference: 'PANTRA-abc' });
  });

  it('the same reference again is reported as already recorded, not credited twice', async () => {
    const { client } = db({ code: '23505', message: 'duplicate key' });
    expect(await recordCommissionSettlement(client, params)).toEqual({ recorded: false });
  });

  it('any other database error is thrown', async () => {
    const { client } = db({ code: '42501', message: 'permission denied' });
    await expect(recordCommissionSettlement(client, params)).rejects.toThrow('permission denied');
  });
});
