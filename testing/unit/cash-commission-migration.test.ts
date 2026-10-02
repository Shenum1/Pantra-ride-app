import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Static source guards on database/schemas/supabase-schema-cash-commission-ledger.sql.
// There's no Postgres test harness in this codebase (same documented
// limitation as the other trigger/RLS checks), so these pin the specific
// properties whose absence would break production silently.
const sql = fs.readFileSync(
  path.resolve(process.cwd(), 'database/schemas/supabase-schema-cash-commission-ledger.sql'),
  'utf8'
);

// SQL keywords appear in both cases in this file (FUNCTION / function).
function functionBody(name: string): string {
  const start = sql.search(new RegExp(`function public\\.${name}\\(`, 'i'));
  expect(start, `${name} must be defined`).toBeGreaterThan(-1);
  const end = sql.indexOf('$$;', start);
  return sql.slice(start, end);
}

describe('cash-commission migration', () => {
  it('the ledger-debit trigger is SECURITY DEFINER — it runs inside the driver\'s own "complete ride" update, and the ledger has no insert policy', () => {
    expect(functionBody('rides_cash_commission_debit_trigger')).toMatch(/security definer/i);
  });

  it('cash detection is shared, resolves saved-method ids, and can read the rider\'s payment_methods row', () => {
    const helper = functionBody('ride_payment_is_cash');
    expect(helper).toMatch(/security definer/i);
    expect(helper).toMatch(/payment_methods/);
    expect(functionBody('rides_settle_trigger')).toContain('ride_payment_is_cash(NEW."paymentMethod")');
    expect(functionBody('rides_cash_commission_debit_trigger')).toContain('ride_payment_is_cash(NEW."paymentMethod")');
  });

  it('both balance functions include tips, the commission ledger, and reserve payouts awaiting manual payout', () => {
    for (const name of ['get_driver_available_balance', 'get_driver_net_balance']) {
      const body = functionBody(name);
      expect(body, name).toContain('public.tips');
      expect(body, name).toContain('public.driver_commission_ledger');
      expect(body, name).toContain("'manual_review'");
    }
  });
});

describe('cash-commission settlement migration', () => {
  const settlementSql = fs.readFileSync(
    path.resolve(process.cwd(), 'database/schemas/supabase-schema-cash-commission-settlement.sql'),
    'utf8'
  );
  const body = (name: string) => {
    const start = settlementSql.search(new RegExp(`function public\\.${name}\\(`, 'i'));
    expect(start, `${name} must be defined`).toBeGreaterThan(-1);
    return settlementSql.slice(start, settlementSql.indexOf('$$;', start));
  };

  it('the accept-time block is SECURITY DEFINER, only applies to cash rides, and uses the shared limit', () => {
    const guard = body('rides_cash_dispatch_guard_trigger');
    expect(guard).toMatch(/security definer/i);
    expect(guard).toContain("NEW.\"status\" = 'accepted'");
    expect(guard).toContain('ride_payment_is_cash(NEW."paymentMethod")');
    expect(guard).toContain('get_driver_cash_debt_limit()');
    // The app recognizes this prefix to show a readable message.
    expect(guard).toContain('CASH_RIDES_PAUSED');
  });

  it('the limit defaults to ₦5,000', () => {
    expect(settlementSql).toMatch(/"cashDebtLimit" numeric\(12,2\) not null default 5000/);
    expect(body('get_driver_cash_debt_limit')).toContain('5000');
  });

  it('a settlement can only be recorded once per payment reference', () => {
    expect(settlementSql).toMatch(
      /create unique index[\s\S]*?on public\.driver_commission_ledger \("reference"\)\s*where "type" = 'cash_commission_settlement'/i
    );
  });

  it("the all-drivers summary isn't callable by app users", () => {
    expect(settlementSql).toMatch(/revoke all on function public\.get_drivers_commission_summary\(\) from public, anon, authenticated/);
  });
});
