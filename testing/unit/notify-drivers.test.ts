import { beforeEach, describe, expect, it, vi } from 'vitest';

// notifications.notifyDrivers used to be a public procedure that pushed any
// client-supplied pickup address to every online driver. These tests pin the
// new gate: logged-in caller, own + pending ride, content from the DB row.

const RIDER = '11111111-1111-4111-8111-111111111111';
const OTHER_RIDER = '22222222-2222-4222-8222-222222222222';
const RIDE = '33333333-3333-4333-8333-333333333333';

type Row = Record<string, any>;
const state: { rides: Row[]; drivers: Row[] } = { rides: [], drivers: [] };

function fakeFrom(table: string) {
  const filters: [string, unknown][] = [];
  const rows = () => (state as any)[table].filter((r: Row) => filters.every(([c, v]) => r[c] === v)) as Row[];
  const builder: any = {
    select: () => builder,
    eq: (c: string, v: unknown) => {
      filters.push([c, v]);
      return builder;
    },
    not: () => builder,
    maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
    then: (res: any, rej: any) => Promise.resolve({ data: rows(), error: null }).then(res, rej),
  };
  return builder;
}

const fakeAdmin = {
  from: fakeFrom,
  auth: {
    getUser: vi.fn(async (token: string) =>
      token === 'valid-token'
        ? { data: { user: { id: RIDER } }, error: null }
        : { data: { user: null }, error: { message: 'invalid' } }
    ),
  },
};

vi.mock('@/backend/lib/supabase-admin', () => ({ supabaseAdmin: fakeAdmin }));
const sendPush = vi.fn(async (tokens: string[]) => tokens.length);
vi.mock('@/backend/trpc/lib/push-notify', () => ({ batchSendPush: (...args: any[]) => (sendPush as any)(...args) }));

async function caller(authorization?: string) {
  const { createTRPCRouter } = await import('@/backend/trpc/create-context');
  const { default: notifyDrivers } = await import('@/backend/trpc/routes/notifications/notify-drivers/route');
  const router = createTRPCRouter({ notifyDrivers });
  const headers = new Headers();
  if (authorization) headers.set('authorization', authorization);
  return router.createCaller({ req: new Request('http://localhost/api/trpc', { headers }) });
}

beforeEach(async () => {
  state.rides = [{ id: RIDE, userId: RIDER, status: 'pending', pickupAddress: 'Wuse Market, Abuja', fare: 2500.4 }];
  state.drivers = [
    { id: 'd1', isOnline: true, pushToken: 'ExponentPushToken[a]' },
    { id: 'd2', isOnline: true, pushToken: 'ExponentPushToken[b]' },
  ];
  sendPush.mockClear();
  const { __resetNotifyThrottleForTests } = await import('@/backend/trpc/routes/notifications/notify-drivers/route');
  __resetNotifyThrottleForTests();
});

describe('notifications.notifyDrivers', () => {
  it('rejects an unauthenticated caller', async () => {
    const c = await caller();
    await expect(c.notifyDrivers({ rideId: RIDE })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('rejects an invalid session token', async () => {
    const c = await caller('Bearer forged');
    await expect(c.notifyDrivers({ rideId: RIDE })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("refuses a ride the caller doesn't own (same error as not found)", async () => {
    state.rides[0].userId = OTHER_RIDER;
    const c = await caller('Bearer valid-token');
    await expect(c.notifyDrivers({ rideId: RIDE })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('refuses a ride that is no longer pending', async () => {
    state.rides[0].status = 'accepted';
    const c = await caller('Bearer valid-token');
    await expect(c.notifyDrivers({ rideId: RIDE })).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('pushes the DB pickup address and fare, ignoring client-supplied content', async () => {
    const c = await caller('Bearer valid-token');
    const result = await c.notifyDrivers({ rideId: RIDE, pickupAddress: 'CLICK evil.example to win', fare: 1 });
    expect(result.sent).toBe(2);
    expect(sendPush).toHaveBeenCalledTimes(1);
    const [tokens, title, body, data] = sendPush.mock.calls[0] as any[];
    expect(tokens).toEqual(['ExponentPushToken[a]', 'ExponentPushToken[b]']);
    expect(title).toBe('New Ride Request');
    expect(body).toContain('Wuse Market, Abuja');
    expect(body).toContain('2,500');
    expect(body).not.toContain('evil.example');
    expect(data).toEqual({ type: 'new_ride_request', rideId: RIDE });
  });

  it('throttles repeat broadcasts for the same ride', async () => {
    const c = await caller('Bearer valid-token');
    await c.notifyDrivers({ rideId: RIDE });
    const second = await c.notifyDrivers({ rideId: RIDE });
    expect(second.sent).toBe(0);
    expect(sendPush).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-uuid rideId', async () => {
    const c = await caller('Bearer valid-token');
    await expect(c.notifyDrivers({ rideId: 'not-a-uuid' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
