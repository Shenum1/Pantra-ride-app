import { beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

beforeAll(() => {
  process.env.BANK_ACCOUNT_ENCRYPTION_KEY = randomBytes(32).toString('base64');
});

type Row = Record<string, any>;

// Minimal supabase-js stand-in for the backfill's query shapes:
// select().is().order().limit().gt() and update().eq().is().
function fakeDb(tables: Record<string, Row[]>, opts: { failUpdateFor?: string } = {}) {
  function from(table: string) {
    tables[table] ??= [];
    let op: 'select' | 'update' = 'select';
    let values: Row = {};
    let limit = Infinity;
    const preds: ((r: Row) => boolean)[] = [];
    const run = () => {
      const rows = tables[table].filter((r) => preds.every((p) => p(r)));
      if (op === 'update') {
        if (rows.some((r) => r.id === opts.failUpdateFor)) return { data: null, error: { message: 'boom' } };
        rows.forEach((r) => Object.assign(r, values));
        return { data: rows, error: null };
      }
      return { data: rows.sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, limit).map((r) => ({ ...r })), error: null };
    };
    const b: any = {
      select: () => b,
      update: (v: Row) => ((op = 'update'), (values = v), b),
      is: (c: string, v: unknown) => (preds.push((r) => (r[c] ?? null) === v), b),
      eq: (c: string, v: unknown) => (preds.push((r) => r[c] === v), b),
      gt: (c: string, v: string) => (preds.push((r) => r[c] > v), b),
      order: () => b,
      limit: (n: number) => ((limit = n), b),
      then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
    };
    return b;
  }
  return { from } as any;
}

describe('bank account backfill', () => {
  it('encrypts plaintext rows in both tables, sets last4, and leaves already-encrypted rows alone', async () => {
    const { backfillTable } = await import('@/backend/lib/bank-account-backfill');
    const { decryptAccountNumber } = await import('@/backend/lib/bank-account-crypto');
    const tables: Record<string, Row[]> = {
      driver_bank_accounts: [
        { id: 'a', accountNumber: '0123456789', accountNumberEncrypted: null },
        { id: 'b', accountNumber: '9999999999', accountNumberEncrypted: 'already-encrypted' },
      ],
      wallet_bank_accounts: [
        { id: 'c', accountNumber: '1112223334', accountNumberEncrypted: null },
        { id: 'd', accountNumber: null, accountNumberEncrypted: null },
      ],
    };
    const db = fakeDb(tables);

    const driver = await backfillTable(db, 'driver_bank_accounts');
    const wallet = await backfillTable(db, 'wallet_bank_accounts');

    expect(driver).toMatchObject({ scanned: 1, encrypted: 1, failed: [] });
    expect(wallet).toMatchObject({ scanned: 2, encrypted: 1, skippedEmpty: 1, failed: [] });

    const a = tables.driver_bank_accounts[0];
    expect(a.accountNumberEncrypted).not.toContain('0123456789');
    expect(decryptAccountNumber(a.accountNumberEncrypted)).toBe('0123456789');
    expect(a.accountNumberLast4).toBe('6789');
    expect(tables.driver_bank_accounts[1].accountNumberEncrypted).toBe('already-encrypted');
    expect(decryptAccountNumber(tables.wallet_bank_accounts[0].accountNumberEncrypted)).toBe('1112223334');
  });

  it('is re-runnable (second run finds nothing to do)', async () => {
    const { backfillTable } = await import('@/backend/lib/bank-account-backfill');
    const tables: Record<string, Row[]> = { wallet_bank_accounts: [{ id: 'c', accountNumber: '1112223334', accountNumberEncrypted: null }] };
    const db = fakeDb(tables);
    await backfillTable(db, 'wallet_bank_accounts');
    const again = await backfillTable(db, 'wallet_bank_accounts');
    expect(again).toMatchObject({ scanned: 0, encrypted: 0 });
  });

  it('dry run writes nothing', async () => {
    const { backfillTable } = await import('@/backend/lib/bank-account-backfill');
    const tables: Record<string, Row[]> = { driver_bank_accounts: [{ id: 'a', accountNumber: '0123456789', accountNumberEncrypted: null }] };
    const result = await backfillTable(fakeDb(tables), 'driver_bank_accounts', { dryRun: true });
    expect(result.encrypted).toBe(1);
    expect(tables.driver_bank_accounts[0].accountNumberEncrypted).toBeNull();
  });

  it('reports failed rows instead of hiding them', async () => {
    const { backfillTable } = await import('@/backend/lib/bank-account-backfill');
    const tables: Record<string, Row[]> = { driver_bank_accounts: [{ id: 'a', accountNumber: '0123456789', accountNumberEncrypted: null }] };
    const result = await backfillTable(fakeDb(tables, { failUpdateFor: 'a' }), 'driver_bank_accounts');
    expect(result.failed).toEqual([{ id: 'a', reason: 'boom' }]);
  });

  it('refuses to run without the encryption key', async () => {
    const { backfillTable } = await import('@/backend/lib/bank-account-backfill');
    const saved = process.env.BANK_ACCOUNT_ENCRYPTION_KEY;
    delete process.env.BANK_ACCOUNT_ENCRYPTION_KEY;
    try {
      const tables: Record<string, Row[]> = { driver_bank_accounts: [{ id: 'a', accountNumber: '0123456789', accountNumberEncrypted: null }] };
      const result = await backfillTable(fakeDb(tables), 'driver_bank_accounts');
      expect(result.failed).toHaveLength(1);
      expect(tables.driver_bank_accounts[0].accountNumberEncrypted).toBeNull();
    } finally {
      process.env.BANK_ACCOUNT_ENCRYPTION_KEY = saved;
    }
  });
});

describe('no code reads or writes the plaintext accountNumber column', () => {
  const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

  it('payout processor and admin reveal select only the encrypted column', () => {
    for (const file of ['backend/lib/payout-processor.ts', 'backend/trpc/routes/admin/payouts/reveal-bank-account/route.ts']) {
      const selects = read(file).match(/\.select\("[^"]*"\)/g) ?? [];
      for (const s of selects) expect(s, `${file}: ${s}`).not.toMatch(/\baccountNumber\b/);
    }
  });

  it('driver add route stores only ciphertext + last4', () => {
    const src = read('backend/trpc/routes/driver/bank-accounts/add/route.ts');
    const insert = src.slice(src.indexOf('.insert({'), src.indexOf('})', src.indexOf('.insert({')));
    expect(insert).toContain('accountNumberEncrypted: encryptAccountNumber(input.accountNumber)');
    expect(insert).not.toMatch(/\n\s*accountNumber:/);
  });
});

describe('bank account migrations', () => {
  const hardening = fs.readFileSync(path.resolve(process.cwd(), 'database/schemas/supabase-schema-backend-hardening.sql'), 'utf8');
  const drop = fs.readFileSync(path.resolve(process.cwd(), 'database/schemas/supabase-schema-bank-accounts-drop-plaintext.sql'), 'utf8');

  it('hardening adds encrypted columns to wallet_bank_accounts and locks client writes', () => {
    expect(hardening).toContain('alter table public.wallet_bank_accounts add column if not exists "accountNumberEncrypted" text;');
    expect(hardening).toContain('alter table public.wallet_bank_accounts add column if not exists "accountNumberLast4" text;');
    expect(hardening).toContain('drop policy if exists "Users can insert own bank accounts" on public.wallet_bank_accounts;');
    expect(hardening).toContain('drop policy if exists "Users can update own bank accounts" on public.wallet_bank_accounts;');
    expect(hardening).toContain('revoke insert, update on public.wallet_bank_accounts from anon, authenticated;');
    // The destructive step is NOT in the first migration.
    expect(hardening).not.toMatch(/drop column/i);
  });

  it('drop migration guards on unencrypted plaintext before dropping, for both tables', () => {
    expect(drop).toContain(`array['driver_bank_accounts', 'wallet_bank_accounts']`);
    expect(drop).toContain('"accountNumber" is not null and "accountNumberEncrypted" is null');
    expect(drop).toMatch(/if unencrypted > 0 then\s+raise exception/);
    expect(drop.indexOf('raise exception')).toBeLessThan(drop.indexOf('drop column'));
  });
});

describe('admin access log', () => {
  it('writes identifiers only, and never throws on failure (reported via console.error)', async () => {
    const { recordAdminAccess } = await import('@/backend/lib/admin-access-log');
    const inserts: Row[] = [];
    const okDb: any = { from: (t: string) => ({ insert: async (v: Row) => (inserts.push({ t, ...v }), { error: null }) }) };
    await expect(
      recordAdminAccess(okDb, { adminUserId: 'admin-1', action: 'view_rider_detail', subjectType: 'rider', subjectId: 'r-1' })
    ).resolves.toBe(true);
    expect(inserts).toEqual([
      { t: 'admin_access_log', adminUserId: 'admin-1', action: 'view_rider_detail', subjectType: 'rider', subjectId: 'r-1', metadata: {} },
    ]);

    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const errorDb: any = { from: () => ({ insert: async () => ({ error: { message: 'relation does not exist' } }) }) };
    const throwingDb: any = { from: () => { throw new Error('network'); } };
    await expect(recordAdminAccess(errorDb, { adminUserId: 'a', action: 'reveal_bank_account', subjectType: 'driver_bank_account', subjectId: 'b' })).resolves.toBe(false);
    await expect(recordAdminAccess(throwingDb, { adminUserId: 'a', action: 'reveal_bank_account', subjectType: 'driver_bank_account', subjectId: 'b' })).resolves.toBe(false);
    expect(err).toHaveBeenCalledTimes(2);
    err.mockRestore();
  });

  it('revealing a bank account decrypts and records the access; logging failure does not block the reveal', async () => {
    const { encryptAccountNumber } = await import('@/backend/lib/bank-account-crypto');
    const { revealBankAccount } = await import('@/backend/trpc/routes/admin/payouts/reveal-bank-account/route');
    const ciphertext = encryptAccountNumber('0690000032');
    const logged: Row[] = [];
    const db: any = {
      from: (t: string) => {
        if (t === 'admin_access_log') return { insert: async (v: Row) => (logged.push(v), { error: { message: 'down' } }) };
        const b: any = { select: () => b, eq: () => b, maybeSingle: async () => ({ data: { id: 'bank-1', accountNumberEncrypted: ciphertext }, error: null }) };
        return b;
      },
    };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await revealBankAccount(db, 'admin-1', 'bank-1');
    err.mockRestore();
    expect(result).toEqual({ accountNumber: '0690000032' });
    expect(logged).toEqual([
      { adminUserId: 'admin-1', action: 'reveal_bank_account', subjectType: 'driver_bank_account', subjectId: 'bank-1', metadata: {} },
    ]);
    expect(JSON.stringify(logged)).not.toContain('0690000032');
  });

  it('a row with no ciphertext is refused, not revealed from plaintext', async () => {
    const { revealBankAccount } = await import('@/backend/trpc/routes/admin/payouts/reveal-bank-account/route');
    const db: any = {
      from: () => {
        const b: any = { select: () => b, eq: () => b, maybeSingle: async () => ({ data: { id: 'x', accountNumberEncrypted: null, accountNumber: '0123456789' }, error: null }) };
        return b;
      },
    };
    await expect(revealBankAccount(db, 'admin-1', 'x')).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });

  it('rider and driver detail routes record access; the table is service-role only', () => {
    const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');
    expect(read('backend/trpc/routes/admin/riders/get-detail/route.ts')).toMatch(/recordAdminAccess\([\s\S]*action: "view_rider_detail"/);
    expect(read('backend/trpc/routes/admin/driver-verification/get-driver-detail/route.ts')).toMatch(
      /recordAdminAccess\([\s\S]*action: "view_driver_verification_detail"/
    );
    const sql = read('database/schemas/supabase-schema-backend-hardening.sql');
    expect(sql).toContain('create table if not exists public.admin_access_log');
    expect(sql).toContain('alter table public.admin_access_log enable row level security;');
    expect(sql).toContain('revoke all on public.admin_access_log from anon, authenticated;');
    expect(sql).not.toMatch(/create policy[^;]*admin_access_log/i);
  });
});
