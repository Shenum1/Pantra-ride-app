import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

describe('drivers.earnings — legacy field is neither authoritative nor client-writable', () => {
  it('protect_driver_verification_columns() now also blocks client writes to "earnings"', async () => {
    const source = await readFile(
      path.resolve(process.cwd(), 'database/schemas/supabase-schema-drivers-earnings-legacy-lock.sql'),
      'utf8'
    );
    expect(source).toMatch(/new\."earnings"\s+is distinct from\s+old\."earnings"/);
  });

  it('app/driver-earnings.tsx no longer reads the stale driverProfile.earnings JSONB for its totals', async () => {
    const source = await readFile(
      path.resolve(process.cwd(), 'app/driver-earnings.tsx'),
      'utf8'
    );
    expect(source).not.toContain('driverProfile.earnings');
    expect(source).toContain('stats.totalEarnings');
  });

  it('get_driver_available_balance() derives from rides.driverEarningsAmount, not drivers.earnings', async () => {
    const source = await readFile(
      path.resolve(process.cwd(), 'database/schemas/supabase-schema-driver-payouts.sql'),
      'utf8'
    );
    expect(source).toContain('driverEarningsAmount');
    expect(source).not.toMatch(/from\s+public\.drivers[\s\S]{0,80}"earnings"/);
  });
});
