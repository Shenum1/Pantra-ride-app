import { describe, expect, it } from 'vitest';
import { appRouter } from '@/backend/trpc/app-router';
import { rideCreateInputSchema } from '@/backend/trpc/routes/rides/create/route';

describe('rides.create — no financial field can be supplied by the client', () => {
  it('the input schema has no fare/fee/commission/distance/duration field at all', () => {
    const shape = rideCreateInputSchema.shape;
    const forbiddenKeys = [
      'fare', 'baseFare', 'minFare', 'maxFare', 'bookingFee', 'serviceFee',
      'priorityFee', 'waitingCharge', 'cancellationFee', 'distance', 'duration',
      'platformCommissionRate', 'platformCommissionAmount', 'driverEarningsAmount',
    ];
    for (const key of forbiddenKeys) {
      expect(Object.prototype.hasOwnProperty.call(shape, key)).toBe(false);
    }
  });

  it('silently strips an attacker-supplied fare field rather than accepting it (zod default "strip" mode)', () => {
    const parsed = rideCreateInputSchema.parse({
      pickupLocation: { latitude: 9.05, longitude: 7.45 },
      dropoffLocation: { latitude: 9.1, longitude: 7.5 },
      pickupAddress: 'A',
      dropoffAddress: 'B',
      fare: 1,
      platformCommissionAmount: 0,
    });
    expect(parsed).not.toHaveProperty('fare');
    expect(parsed).not.toHaveProperty('platformCommissionAmount');
  });
});

describe('admin.payouts.list — never selects a full bank account number', () => {
  it('the route source selects accountNumberLast4, never the raw accountNumber column', async () => {
    // Static source inspection rather than an invocation test: this route
    // requires a mocked service-role Supabase client to actually call (no
    // such DB-mocking harness exists anywhere in this codebase yet — same
    // documented limitation as the SQL trigger/RLS behavior tested only via
    // the manual checklist). Reading the source directly still gives a real
    // regression guard against a future edit re-adding "accountNumber" to
    // this route's select().
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const source = await fs.readFile(
      path.resolve(process.cwd(), 'backend/trpc/routes/admin/payouts/list/route.ts'),
      'utf8'
    );
    expect(source).toContain('accountNumberLast4');
    // Word-boundary match: "accountNumberLast4"/"accountNumberEncrypted" are
    // fine (no boundary between "accountNumber" and the suffix — both are
    // \w characters); a bare "accountNumber" field name is not.
    expect(source).not.toMatch(/\baccountNumber\b/);
  });
});

describe('appRouter integration', () => {
  it('responds from the example hi mutation', async () => {
    const caller = appRouter.createCaller({
      req: new Request('http://localhost/api/trpc'),
    });

    const result = await caller.example.hi({ name: 'Pantra' });

    expect(result.hello).toBe('Pantra');
    expect(result.date).toBeInstanceOf(Date);
  });

  it('validates required mutation input', async () => {
    const caller = appRouter.createCaller({
      req: new Request('http://localhost/api/trpc'),
    });

    await expect(caller.example.hi({} as { name: string })).rejects.toThrow();
  });
});
