import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Account deletion, data export, the rate limiter and server error reporting. The deletion rules themselves
// (what is erased, what stays, what blocks) are tested against a real database in
// supabase/tests/database/account_deletion.test.sql; these run the real routes against a fake database.

const USER = '11111111-1111-4111-8111-111111111111';
const DRIVER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

type Row = Record<string, any>;
const state: {
  tables: Record<string, Row[]>;
  failTable: string | null;
  rpcCalls: { name: string; args: Row }[];
  rpcResults: Record<string, { data?: any; error?: { message: string } | null }>;
  storageRemoved: { bucket: string; paths: string[] }[];
  storageList: Record<string, { name: string }[]>;
  storageRemoveError: boolean;
} = { tables: {}, failTable: null, rpcCalls: [], rpcResults: {}, storageRemoved: [], storageList: {}, storageRemoveError: false };

function fakeFrom(table: string) {
  const result = () =>
    state.failTable === table
      ? { data: null, error: { message: `${table} unavailable` } }
      : { data: state.tables[table] ?? [], error: null };
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve({ data: (state.tables[table] ?? [])[0] ?? null, error: null }),
    then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject),
  };
  return builder;
}

const fakeAdmin: any = {
  from: fakeFrom,
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: USER } }, error: null })) },
  rpc: vi.fn(async (name: string, args: Row) => {
    state.rpcCalls.push({ name, args });
    const configured = state.rpcResults[name];
    if (configured) return { data: configured.data ?? null, error: configured.error ?? null };
    if (name === 'rate_limit_hit') return { data: true, error: null };
    return { data: null, error: null };
  }),
  storage: {
    from: (bucket: string) => ({
      list: async (folder: string) => ({ data: state.storageList[`${bucket}:${folder}`] ?? [], error: null }),
      remove: async (paths: string[]) => {
        state.storageRemoved.push({ bucket, paths });
        return { data: null, error: state.storageRemoveError ? { message: 'storage down' } : null };
      },
    }),
  },
};

vi.mock('@/backend/lib/supabase-admin', () => ({ supabaseAdmin: fakeAdmin }));

async function callAccount<K extends 'deletionCheck' | 'delete' | 'exportData'>(name: K, input?: unknown) {
  const { createTRPCRouter } = await import('@/backend/trpc/create-context');
  const deletionCheck = (await import('@/backend/trpc/routes/account/deletion-check/route')).default;
  const del = (await import('@/backend/trpc/routes/account/delete/route')).default;
  const exportData = (await import('@/backend/trpc/routes/account/export-data/route')).default;
  const router = createTRPCRouter({ deletionCheck, delete: del, exportData });
  const headers = new Headers({ authorization: 'Bearer valid-token' });
  const caller: any = router.createCaller({ req: new Request('http://localhost/api/trpc', { headers }) });
  return caller[name](input);
}

beforeEach(() => {
  state.tables = {};
  state.failTable = null;
  state.rpcCalls = [];
  state.rpcResults = {};
  state.storageRemoved = [];
  state.storageList = {};
  state.storageRemoveError = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('account.deletionCheck', () => {
  it('asks the database what blocks deletion, for the signed-in user only', async () => {
    state.rpcResults.account_deletion_blockers = { data: ['WALLET_BALANCE', 'ACTIVE_RIDE'] };
    const result = await callAccount('deletionCheck');
    expect(result).toEqual({ blockers: ['WALLET_BALANCE', 'ACTIVE_RIDE'] });
    expect(state.rpcCalls.find((c) => c.name === 'account_deletion_blockers')?.args).toEqual({ p_user_id: USER });
  });
});

describe('account.delete', () => {
  it('needs the exact confirmation word', async () => {
    await expect(callAccount('delete', { confirm: 'delete' })).rejects.toThrow();
    expect(state.rpcCalls.filter((c) => c.name === 'anonymise_account')).toHaveLength(0);
  });

  it('erases the signed-in user and nobody else', async () => {
    const result = await callAccount('delete', { confirm: 'DELETE' });
    expect(result).toEqual({ deleted: true });
    expect(state.rpcCalls.find((c) => c.name === 'anonymise_account')?.args).toEqual({ p_user_id: USER });
  });

  it('refuses while the account is blocked, and passes the reasons on', async () => {
    state.rpcResults.anonymise_account = { error: { message: 'ACCOUNT_DELETION_BLOCKED:WALLET_BALANCE,ACTIVE_RIDE' } };
    await expect(callAccount('delete', { confirm: 'DELETE' })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'ACCOUNT_DELETION_BLOCKED:WALLET_BALANCE,ACTIVE_RIDE',
    });
    expect(state.storageRemoved).toHaveLength(0);
  });

  it('removes a driver\'s uploaded documents and photos from storage', async () => {
    state.rpcResults.anonymise_account = {
      data: { driverId: DRIVER_ID, documentPaths: [`drivers/${DRIVER_ID}/license_1`] },
    };
    state.storageList[`documents:drivers/${DRIVER_ID}`] = [{ name: 'license_1' }, { name: 'selfie_2' }];
    state.storageList[`avatars:users/${USER}`] = [{ name: 'profile.jpg' }];
    await callAccount('delete', { confirm: 'DELETE' });
    const documents = state.storageRemoved.find((r) => r.bucket === 'documents');
    expect(documents?.paths.sort()).toEqual([`drivers/${DRIVER_ID}/license_1`, `drivers/${DRIVER_ID}/selfie_2`]);
    const avatars = state.storageRemoved.find((r) => r.bucket === 'avatars');
    expect(avatars?.paths.sort()).toEqual([`drivers/${DRIVER_ID}.jpg`, `users/${USER}/profile.jpg`]);
  });

  it('still succeeds, and says so loudly, when the stored files cannot be removed (the account is already erased)', async () => {
    state.rpcResults.anonymise_account = { data: { driverId: DRIVER_ID, documentPaths: ['drivers/x/y'] } };
    state.storageRemoveError = true;
    const result = await callAccount('delete', { confirm: 'DELETE' });
    expect(result).toEqual({ deleted: true });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('could NOT all be removed'), expect.anything());
  });

  it('is rate limited', async () => {
    state.rpcResults.rate_limit_hit = { data: false };
    await expect(callAccount('delete', { confirm: 'DELETE' })).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
    expect(state.rpcCalls.filter((c) => c.name === 'anonymise_account')).toHaveLength(0);
  });
});

describe('account.exportData', () => {
  beforeEach(() => {
    state.tables = {
      users: [{ uid: USER, displayName: 'Ada', email: 'ada@example.com', pushToken: 'secret-push-token' }],
      rides: [{ id: 'r1', userId: USER, fare: 1500, pickupAddress: '1 Home Street' }],
      wallet_transactions: [{ id: 't1', userId: USER, amount: -1500 }],
    };
  });

  it('returns the user\'s own records, without technical tokens', async () => {
    const data = await callAccount('exportData');
    expect(data.account.profile).toMatchObject({ displayName: 'Ada', email: 'ada@example.com' });
    expect(data.account.profile).not.toHaveProperty('pushToken');
    expect(data.trips).toHaveLength(1);
    expect(data.walletTransactions).toHaveLength(1);
    expect(data.driver).toBeNull();
    expect(JSON.stringify(data)).not.toContain('secret-push-token');
  });

  it('for a driver: bank details are only the last four digits, and the rider\'s places and passenger are left out', async () => {
    state.tables.drivers = [{ id: DRIVER_ID, userId: USER, name: 'Ada', pushToken: 'driver-push-token', licenseNumber: 'LIC-9' }];
    state.tables.driver_bank_accounts = [
      { id: 'b1', driverId: DRIVER_ID, bankName: 'Bank', accountNumber: '0123456789', accountNumberEncrypted: 'ciphertext', accountNumberLast4: '6789', paystackRecipientCode: 'RCP_1' },
    ];
    state.tables.rides = [
      { id: 'r9', userId: 'someone-else', driverId: DRIVER_ID, fare: 2000, pickupAddress: 'Rider home', dropoffAddress: 'Rider work', passengerName: 'Rider', passengerPhone: '+234', pickupLocation: { latitude: 1 } },
    ];
    const data = await callAccount('exportData');
    const json = JSON.stringify(data.driver);
    expect(data.driver.profile).toMatchObject({ licenseNumber: 'LIC-9' });
    expect(json).not.toContain('driver-push-token');
    expect(data.driver.bankAccounts[0]).toEqual({ id: 'b1', driverId: DRIVER_ID, bankName: 'Bank', accountNumberLast4: '6789' });
    expect(data.driver.trips[0]).toEqual({ id: 'r9', driverId: DRIVER_ID, fare: 2000 });
  });

  it('fails as a whole instead of handing over an incomplete copy', async () => {
    state.failTable = 'wallet_transactions';
    await expect(callAccount('exportData')).rejects.toThrow(/Could not read your wallet transactions/);
  });

  it('is rate limited', async () => {
    state.rpcResults.rate_limit_hit = { data: false };
    await expect(callAccount('exportData')).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });
});

describe('enforceRateLimit', () => {
  it('lets a request through while under the limit, and refuses once over', async () => {
    const { enforceRateLimit } = await import('@/backend/lib/rate-limit');
    await expect(enforceRateLimit(fakeAdmin, 'k', 3, 60)).resolves.toBeUndefined();
    state.rpcResults.rate_limit_hit = { data: false };
    await expect(enforceRateLimit(fakeAdmin, 'k', 3, 60, 'Slow down')).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      message: 'Slow down',
    });
  });

  it('fails open: a broken counter never blocks a booking', async () => {
    const { enforceRateLimit } = await import('@/backend/lib/rate-limit');
    state.rpcResults.rate_limit_hit = { error: { message: 'db down' } };
    await expect(enforceRateLimit(fakeAdmin, 'k', 3, 60)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Rate limiter unavailable'));
  });
});

describe('error reporting', () => {
  it('does nothing when no DSN is configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('SENTRY_DSN', '');
    const { reportServerError, flushErrorReports } = await import('@/backend/lib/error-reporting');
    reportServerError(new Error('boom'));
    await flushErrorReports();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends one envelope to the project\'s endpoint, with the error and where it happened, and waits for it', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('SENTRY_DSN', 'https://abc123@o1.ingest.sentry.io/4242');
    const { reportServerError, flushErrorReports } = await import('@/backend/lib/error-reporting');
    reportServerError(new Error('payment exploded'), { where: 'trpc rides.create', userId: USER });
    await flushErrorReports();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://o1.ingest.sentry.io/api/4242/envelope/?sentry_key=abc123&sentry_version=7');
    const [header, itemHeader, event] = String(init.body).split('\n').map((l) => JSON.parse(l));
    expect(header.dsn).toBe('https://abc123@o1.ingest.sentry.io/4242');
    expect(itemHeader).toEqual({ type: 'event' });
    expect(event.exception.values[0]).toMatchObject({ type: 'Error', value: 'payment exploded' });
    expect(event.tags).toEqual({ where: 'trpc rides.create' });
    expect(event.user).toEqual({ id: USER });
  });

  it('never throws, even if Sentry is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    vi.stubEnv('SENTRY_DSN', 'https://abc123@o1.ingest.sentry.io/4242');
    const { reportServerError, flushErrorReports } = await import('@/backend/lib/error-reporting');
    expect(() => reportServerError(new Error('boom'))).not.toThrow();
    await expect(flushErrorReports()).resolves.toBeUndefined();
  });

  it('ignores a malformed DSN', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('SENTRY_DSN', 'not a dsn');
    const { reportServerError, flushErrorReports } = await import('@/backend/lib/error-reporting');
    reportServerError(new Error('boom'));
    await flushErrorReports();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('wiring', () => {
  it('the server reports unhandled errors and real server faults, and flushes before responding', () => {
    const hono = read('backend/hono.ts');
    expect(hono).toContain('app.onError(');
    expect(hono).toContain('await flushErrorReports();');
    expect(hono).toMatch(/error\.code === "INTERNAL_SERVER_ERROR"/);
  });

  it('the abuse-prone routes are rate limited', () => {
    const limited: Record<string, string> = {
      'backend/trpc/routes/rides/create/route.ts': 'rides-create:',
      'backend/trpc/routes/payments/flutterwave/initialize/route.ts': 'topup-init:',
      'backend/trpc/routes/payments/tips/create/route.ts': 'tip-create:',
      'backend/trpc/routes/support/create-ticket/route.ts': 'support-ticket:',
      'backend/trpc/routes/support/reply/route.ts': 'support-reply:',
      'backend/trpc/routes/driver/bank-accounts/add/route.ts': 'bank-add:',
      'backend/trpc/routes/driver/payouts/request/route.ts': 'payout-request:',
      'backend/trpc/routes/account/delete/route.ts': 'account-delete:',
      'backend/trpc/routes/account/export-data/route.ts': 'account-export:',
    };
    for (const [file, key] of Object.entries(limited)) {
      const source = read(file);
      expect(source, file).toContain('enforceRateLimit(');
      expect(source, file).toContain(key);
    }
    expect(read('backend/lib/google-maps-proxy.ts')).toContain('google-maps:');
  });

  it('the database functions are for the backend only', () => {
    const sql = read('supabase/migrations/20261009000100_account_deletion.sql').replace(/--[^\n]*/g, '');
    for (const fn of ['account_deletion_blockers(uuid)', 'anonymise_account(uuid)', 'rate_limit_hit(text, integer, integer)']) {
      expect(sql).toContain(`revoke all on function public.${fn} from public, anon, authenticated;`);
      expect(sql).toContain(`grant execute on function public.${fn} to service_role;`);
    }
    expect(sql).toContain('alter table public.rate_limits enable row level security;');
  });
});

describe('the app side', () => {
  it('turns a refused deletion into the reasons, and anything else into null', async () => {
    vi.doMock('@/lib/trpc', () => ({ trpcClient: {} }));
    const { blockersFromError, describeBlocker } = await import('@/lib/account-service');
    expect(blockersFromError(new Error('ACCOUNT_DELETION_BLOCKED:WALLET_BALANCE,ACTIVE_RIDE'))).toEqual(['WALLET_BALANCE', 'ACTIVE_RIDE']);
    expect(blockersFromError(new Error('network down'))).toBeNull();
    expect(describeBlocker('WALLET_BALANCE')).toMatch(/wallet still has money/i);
    expect(describeBlocker('SOMETHING_NEW')).toMatch(/contact support/i);
  });

  it('riders and drivers can download their data and reach the delete screen; nothing sends them to support instead', () => {
    const privacy = read('app/privacy.tsx');
    expect(privacy).toContain('AccountService.downloadMyData()');
    expect(privacy).toContain("router.push('/delete-account')");
    expect(privacy).not.toContain('Request My Data or Account Deletion');
    const driver = read('app/driver-privacy-security.tsx');
    expect(driver).toContain('AccountService.downloadMyData()');
    expect(driver).toContain("router.push('/delete-account')");
  });

  it('the delete screen shows what blocks deletion and needs DELETE typed before the button works', () => {
    const screen = read('app/delete-account.tsx');
    expect(screen).toContain('AccountService.getDeletionBlockers()');
    expect(screen).toContain("typed.trim() === 'DELETE'");
    expect(screen).toContain('disabled={!canDelete}');
    expect(screen).toContain('blockersFromError(error)');
  });

  it('crash reporting starts at launch, never sends personal details, and the web build gets a no-op', () => {
    const monitoring = read('lib/monitoring.ts');
    expect(monitoring).toContain('sendDefaultPii: false');
    expect(monitoring).toContain('Sentry.setUser(session?.user ? { id: session.user.id } : null)');
    expect(monitoring).toContain('__DEV__');
    expect(read('lib/monitoring.web.ts')).not.toContain('@sentry');
    const layout = read('app/_layout.tsx');
    expect(layout).toContain('initMonitoring();');
    expect(layout).toContain('export default wrapRootComponent(RootLayout);');
    expect(read('components/ErrorBoundary.tsx')).toContain('reportError(error');
  });
});
