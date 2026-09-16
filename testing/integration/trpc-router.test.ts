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
      'fareSource',
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

  // Test C — the client cannot claim its own distance was Google-sourced.
  // fareSource is entirely absent from the input schema (asserted above) and
  // the route always derives it from directions.fareSource (the backend's
  // own getServerDirections() call), never from `input` — so there is no
  // code path by which a client-supplied value, even if one were accepted,
  // could reach the inserted row.
  it('strips an attacker-supplied fareSource claiming Google Directions was used', () => {
    const parsed = rideCreateInputSchema.parse({
      pickupLocation: { latitude: 9.05, longitude: 7.45 },
      dropoffLocation: { latitude: 9.1, longitude: 7.5 },
      pickupAddress: 'A',
      dropoffAddress: 'B',
      fareSource: 'google_directions',
    });
    expect(parsed).not.toHaveProperty('fareSource');
  });

  it('the route source derives fareSource from directions.fareSource, never from input', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const source = await fs.readFile(
      path.resolve(process.cwd(), 'backend/trpc/routes/rides/create/route.ts'),
      'utf8'
    );
    expect(source).toContain('fareSource: directions.fareSource');
    expect(source).not.toMatch(/fareSource:\s*input\./);
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

describe('payments.{paystack,flutterwave}.initialize — require authentication (Phase 2)', () => {
  it('paystack.initialize rejects an unauthenticated call rather than executing as publicProcedure', async () => {
    const caller = appRouter.createCaller({ req: new Request('http://localhost/api/trpc') });
    await expect(
      caller.payments.paystack.initialize({ amount: 5000, email: 'rider@example.com' })
    ).rejects.toThrow();
  });

  it('flutterwave.initialize rejects an unauthenticated call rather than executing as publicProcedure', async () => {
    const caller = appRouter.createCaller({ req: new Request('http://localhost/api/trpc') });
    await expect(
      caller.payments.flutterwave.initialize({ amount: 5000, email: 'rider@example.com' })
    ).rejects.toThrow();
  });

  it('neither initialize route accepts a client-supplied reference/tx_ref anymore', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const [paystackSource, flutterwaveSource] = await Promise.all([
      fs.readFile(path.resolve(process.cwd(), 'backend/trpc/routes/payments/paystack/initialize/route.ts'), 'utf8'),
      fs.readFile(path.resolve(process.cwd(), 'backend/trpc/routes/payments/flutterwave/initialize/route.ts'), 'utf8'),
    ]);
    expect(paystackSource).not.toMatch(/reference:\s*z\./);
    expect(flutterwaveSource).not.toMatch(/tx_ref:\s*z\./);
    expect(paystackSource).toContain('generatePaymentReference()');
    expect(flutterwaveSource).toContain('generatePaymentReference()');
  });
});

describe('driver.payouts.request — requires driver authentication (Phase 3A)', () => {
  it('rejects an unauthenticated call rather than executing as publicProcedure', async () => {
    const caller = appRouter.createCaller({ req: new Request('http://localhost/api/trpc') });
    await expect(
      caller.driver.payouts.request({ bankAccountId: '00000000-0000-0000-0000-000000000000', amount: 1000 })
    ).rejects.toThrow();
  });
});

describe('admin.payouts — no generic status-setter route exists (Phase 3A)', () => {
  it('the old admin.payouts.updateStatus mutation has been removed entirely', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const routerSource = await fs.readFile(path.resolve(process.cwd(), 'backend/trpc/app-router.ts'), 'utf8');
    expect(routerSource).not.toContain('updateStatus: adminPayoutsUpdateStatusRoute');
    expect(routerSource).not.toContain('routes/admin/payouts/update-status/route');

    let routeFileExists = true;
    try {
      await fs.access(path.resolve(process.cwd(), 'backend/trpc/routes/admin/payouts/update-status/route.ts'));
    } catch {
      routeFileExists = false;
    }
    expect(routeFileExists).toBe(false);
  });

  it('every remaining admin.payouts mutation requires admin authentication', async () => {
    const caller = appRouter.createCaller({ req: new Request('http://localhost/api/trpc') });
    await expect(
      caller.admin.payouts.completeManually({ payoutId: '00000000-0000-0000-0000-000000000000', externalReference: 'ref-1' })
    ).rejects.toThrow();
    await expect(
      caller.admin.payouts.failManually({ payoutId: '00000000-0000-0000-0000-000000000000', reason: 'test' })
    ).rejects.toThrow();
    await expect(caller.admin.payouts.retry({ payoutId: '00000000-0000-0000-0000-000000000000' })).rejects.toThrow();
    await expect(
      caller.admin.payouts.moveToManualReview({ payoutId: '00000000-0000-0000-0000-000000000000', reason: 'test' })
    ).rejects.toThrow();
  });

  it('completeManually re-verifies with the provider before completing, and refuses if the payout is not in manual_review', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const source = await fs.readFile(
      path.resolve(process.cwd(), 'backend/trpc/routes/admin/payouts/complete-manually/route.ts'),
      'utf8'
    );
    expect(source).toContain('reconcileOnePayout');
    expect(source).toMatch(/status\s*!==\s*["']manual_review["']/);
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
