import { beforeEach, describe, expect, it, vi } from 'vitest';

// rides.confirmPayment: a trip must be in progress, the wallet pays only what points didn't cover
// (rounded to kobo), and if the ride can't be marked paid after the wallet was debited the debit
// is reversed. Runs the real route against a fake database.

const DRIVER_USER = '22222222-2222-4222-8222-222222222222';
const DRIVER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const RIDER = '11111111-1111-4111-8111-111111111111';
const RIDE = '33333333-3333-4333-8333-333333333333';

type Row = Record<string, any>;
const state: {
  ride: Row;
  updateError: { message: string } | null;
  rpcCalls: { name: string; args: Row }[];
  rpcErrors: Record<string, { message: string } | null>;
} = { ride: {}, updateError: null, rpcCalls: [], rpcErrors: {} };

function fakeFrom(table: string) {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    update: () => ({
      eq: () => Promise.resolve({ error: state.updateError }),
    }),
    single: () =>
      Promise.resolve(
        table === 'drivers'
          ? { data: { id: DRIVER_ID }, error: null }
          : { data: state.ride, error: null }
      ),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  };
  return builder;
}

const fakeAdmin = {
  from: fakeFrom,
  auth: {
    getUser: vi.fn(async () => ({ data: { user: { id: DRIVER_USER } }, error: null })),
  },
  rpc: vi.fn(async (name: string, args: Row) => {
    state.rpcCalls.push({ name, args });
    return { data: null, error: state.rpcErrors[`${name}:${args.p_type ?? ''}`] ?? null };
  }),
};

vi.mock('@/backend/lib/supabase-admin', () => ({ supabaseAdmin: fakeAdmin }));
vi.mock('@/backend/lib/admin-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/backend/lib/admin-auth')>()),
  hasRole: async () => true,
}));

async function confirm() {
  const { createTRPCRouter } = await import('@/backend/trpc/create-context');
  const { default: confirmPayment } = await import('@/backend/trpc/routes/rides/confirm-payment/route');
  const router = createTRPCRouter({ confirmPayment });
  const headers = new Headers({ authorization: 'Bearer valid-token' });
  const caller = router.createCaller({ req: new Request('http://localhost/api/trpc', { headers }) });
  return caller.confirmPayment({ rideId: RIDE });
}

const debits = () => state.rpcCalls.filter((c) => c.args.p_type === 'ride_payment');
const reversals = () => state.rpcCalls.filter((c) => c.args.p_type === 'refund');

beforeEach(() => {
  state.ride = {
    id: RIDE,
    userId: RIDER,
    driverId: DRIVER_ID,
    fare: 1000,
    pointsValueNGN: 0,
    paymentMethod: 'wallet',
    status: 'in-progress',
    paymentStatus: 'unpaid',
  };
  state.updateError = null;
  state.rpcCalls = [];
  state.rpcErrors = {};
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('rides.confirmPayment', () => {
  it('refuses a trip that has not started, before touching the wallet', async () => {
    for (const status of ['pending', 'accepted']) {
      state.ride.status = status;
      const result = await confirm();
      expect(result.status).toBe(false);
      expect(result.message).toMatch(/has not started/i);
    }
    expect(state.rpcCalls).toHaveLength(0);
  });

  it('refuses a ride that is already settled', async () => {
    state.ride.status = 'completed';
    const result = await confirm();
    expect(result.status).toBe(false);
    expect(result.message).toMatch(/already been settled/i);
    expect(state.rpcCalls).toHaveLength(0);
  });

  it('debits a wallet ride its fare and confirms', async () => {
    const result = await confirm();
    expect(result).toEqual({ status: true, message: 'Payment confirmed.' });
    expect(debits()).toHaveLength(1);
    expect(debits()[0].args.p_amount).toBe(-1000);
    expect(reversals()).toHaveLength(0);
  });

  it('debits only what reward points did not cover, rounded to kobo', async () => {
    state.ride.fare = 1234.57;
    state.ride.pointsValueNGN = 800;
    await confirm();
    expect(debits()[0].args.p_amount).toBe(-434.57);
  });

  it('a cash ride debits nothing', async () => {
    state.ride.paymentMethod = 'cash';
    const result = await confirm();
    expect(result.status).toBe(true);
    expect(state.rpcCalls).toHaveLength(0);
  });

  it('is idempotent for a ride that is already paid', async () => {
    state.ride.paymentStatus = 'paid';
    const result = await confirm();
    expect(result).toEqual({ status: true, message: 'Already paid.' });
    expect(state.rpcCalls).toHaveLength(0);
  });

  it('returns the rider\'s money if the ride cannot be marked paid after the debit', async () => {
    state.updateError = { message: 'ride was cancelled' };
    const result = await confirm();
    expect(result).toEqual({ status: false, message: 'ride was cancelled' });
    expect(debits()).toHaveLength(1);
    expect(reversals()).toHaveLength(1);
    expect(reversals()[0].args.p_amount).toBe(1000);
    expect(reversals()[0].args.p_user_id).toBe(RIDER);
    expect(reversals()[0].args.p_reference).toMatch(/^ride-payment-reversal:/);
  });

  it('reverses exactly what was debited when points covered part of the fare', async () => {
    state.ride.fare = 1000;
    state.ride.pointsValueNGN = 496;
    state.updateError = { message: 'boom' };
    await confirm();
    expect(debits()[0].args.p_amount).toBe(-504);
    expect(reversals()[0].args.p_amount).toBe(504);
  });

  it('two reversals for the same ride never share a reference (so the second is not skipped)', async () => {
    state.updateError = { message: 'boom' };
    await confirm();
    await confirm();
    const refs = reversals().map((r) => r.args.p_reference);
    expect(refs).toHaveLength(2);
    expect(new Set(refs).size).toBe(2);
  });

  it('reverses nothing when a cash ride cannot be marked paid', async () => {
    state.ride.paymentMethod = 'cash';
    state.updateError = { message: 'boom' };
    const result = await confirm();
    expect(result.status).toBe(false);
    expect(reversals()).toHaveLength(0);
  });

  it('says so loudly if the reversal itself fails', async () => {
    state.updateError = { message: 'boom' };
    state.rpcErrors['add_wallet_transaction:refund'] = { message: 'db down' };
    const result = await confirm();
    expect(result.status).toBe(false);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('could NOT be reversed'));
  });

  it('does not debit at all when the wallet cannot pay', async () => {
    state.rpcErrors['add_wallet_transaction:ride_payment'] = { message: 'insufficient balance' };
    const result = await confirm();
    expect(result.status).toBe(false);
    expect(result.message).toMatch(/insufficient/i);
    expect(reversals()).toHaveLength(0);
  });
});
