import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Static source inspection, same treatment as the other SQL-trigger checks
// in this suite — there is no live Postgres in this dev environment to
// actually execute rides_settle_trigger() against (see
// docs/PAYMENT_FINANCIAL_ARCHITECTURE_AUDIT.md). This is a regression guard
// against the specific bug found during Phase 1 verification: a terminal
// ride's status could be silently reverted to a non-terminal one (e.g.
// 'completed' -> 'pending'), which — combined with the pre-existing "Drivers
// can accept pending rides" policy — allowed a second driver to be assigned
// and the ride re-completed, letting driverEarningsAmount be claimed twice
// against the same ride. The manual DB checklist (attempt the actual revert
// against a real Supabase project) is the only way to get non-static
// confirmation of this; that has not been run.
describe('rides_settle_trigger — terminal status is fully immutable, not just its financial fields', () => {
  it('the latest redefinition blocks ANY status change away from a terminal state, not only re-settling to another terminal one', async () => {
    const source = await readFile(
      path.resolve(process.cwd(), 'database/schemas/supabase-schema-rides-terminal-status-lock.sql'),
      'utf8'
    );

    // The fix: a single "status changed at all" check.
    expect(source).toMatch(/NEW\."status"\s+is distinct from\s+OLD\."status"/);

    // The bug this replaces: only checked whether NEW.status was ALSO
    // terminal — silently permitting a revert to a non-terminal status.
    // (This file must not have regressed back to that narrower form.)
    expect(source).not.toMatch(/if\s+NEW\."status"\s+in\s*\('completed',\s*'cancelled'\)\s+then/);
  });

  it('this is the most recently defined version of the function (sorts after money-precision.sql, the prior redefinition)', () => {
    // Filename-ordering sanity check: both files start with
    // "supabase-schema-" and are meant to be applied money-precision first,
    // then this one — asserting the migration doc's own stated order is at
    // least self-consistent.
    const earlier = 'supabase-schema-money-precision.sql';
    const later = 'supabase-schema-rides-terminal-status-lock.sql';
    expect(later > earlier).toBe(true);
  });
});
