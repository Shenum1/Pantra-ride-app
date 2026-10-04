import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Source guards on database/schemas/supabase-schema-rider-wallet-lockdown.sql
// (no Postgres test harness in this codebase), plus a check that the rider
// app no longer ships any withdraw-to-bank screen.
const sql = fs.readFileSync(
  path.resolve(process.cwd(), 'database/schemas/supabase-schema-rider-wallet-lockdown.sql'),
  'utf8'
);
const authBlock = sql.slice(sql.indexOf("if auth.role() = 'service_role'"), sql.indexOf('insert into public.wallets'));

describe('rider wallet lockdown migration', () => {
  it("a rider's own session can never withdraw", () => {
    expect(authBlock).toContain("if p_type = 'withdraw' then");
  });

  it("a rider's own session may only debit — never credit under a self-service type", () => {
    expect(authBlock).toContain("if p_type not in ('ride_payment', 'debit') then");
    expect(authBlock).toContain('if p_amount is null or p_amount >= 0 then');
  });

  it('the backend (service role) keeps full access', () => {
    expect(authBlock).toMatch(/if auth\.role\(\) = 'service_role' then\s+null;/);
  });

  it('riders can no longer edit balances or the ledger directly', () => {
    expect(sql).toContain('drop policy if exists "Users can update own wallet" on public.wallets;');
    expect(sql).toContain('drop policy if exists "Users can create own wallet transactions" on public.wallet_transactions;');
    expect(sql).toMatch(/with check \(auth\.uid\(\) = "userId" and "balance" = 0\)/);
  });
});

describe('rider app', () => {
  it('has no withdraw or rider bank-account screens', () => {
    for (const screen of ['wallet-withdraw.tsx', 'wallet-bank-accounts.tsx', 'wallet-add-bank.tsx']) {
      expect(fs.existsSync(path.resolve(process.cwd(), 'app', screen)), screen).toBe(false);
    }
  });
});
