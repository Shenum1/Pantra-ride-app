import { describe, expect, it, vi, beforeEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encryptAccountNumber } from '@/backend/lib/bank-account-crypto';

// Bank account numbers are only ever read from accountNumberEncrypted (the
// legacy plaintext column is being dropped), so fixtures encrypt with a test key.
process.env.BANK_ACCOUNT_ENCRYPTION_KEY ??= randomBytes(32).toString('base64');
import * as payoutProvider from '@/backend/lib/payout-provider';
import * as flutterwaveProvider from '@/backend/lib/flutterwave-payout-provider';
import {
  flutterwaveTransferMayExist,
  initiateAutomaticPayout,
  moveToManualReview,
  processPayoutWebhookEvent,
  reconcileOnePayout,
} from '@/backend/lib/payout-processor';

interface MockPayout {
  id: string;
  driverId: string;
  amount: number;
  bankAccountId: string | null;
  status: string;
  provider: string | null;
  providerTransferReference: string | null;
  providerTransferCode: string | null;
  failureReason?: string | null;
}

interface MockBankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumberEncrypted: string | null;
  bankCode: string | null;
  paystackRecipientCode: string | null;
  recipientVerifiedAt: string | null;
}

function createPayoutSupabaseMock(opts: {
  payout: MockPayout | null;
  bankAccount?: MockBankAccount | null;
  attemptInsertError?: { code: string; message: string } | null;
  eventInsertError?: { code: string; message: string } | null;
  // Pre-existing payout_provider_attempts rows (e.g. from an earlier
  // automatic attempt), in addition to any this test's own calls create.
  attempts?: { attemptStatus: string }[];
}) {
  // Mirrors payout_provider_attempts: an insert adds a row, an update
  // resolves the in-flight ('call_initiated') row, and a select reads them all.
  const attempts: { attemptStatus: string }[] = [...(opts.attempts ?? [])];
  const calls = {
    payoutUpdates: [] as any[],
    bankAccountUpdates: [] as any[],
    attemptInserts: [] as any[],
    attemptUpdates: [] as any[],
    eventInserts: [] as any[],
    reconciliationInserts: [] as any[],
    manualActionInserts: [] as any[],
  };
  // Mirrors the real idx_payout_events_provider_event_id partial unique
  // index: a second insert with the same (provider, providerEventId) is
  // rejected with 23505, exactly like a real duplicate webhook delivery
  // would be — independent of the static eventInsertError override below,
  // which forces every insert to fail regardless of key (used to simulate a
  // generic DB error, not specifically the dedup index).
  const recordedEventKeys = new Set<string>();

  const supabaseAdmin: any = {
    from(table: string) {
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        lt: () => builder,
        limit: () => builder,
        order: () => builder,
        maybeSingle: () => {
          if (table === 'driver_payouts') return Promise.resolve({ data: opts.payout, error: null });
          if (table === 'driver_bank_accounts') return Promise.resolve({ data: opts.bankAccount ?? null, error: null });
          return Promise.resolve({ data: null, error: null });
        },
        single: () => {
          if (table === 'driver_payouts') return Promise.resolve({ data: opts.payout, error: null });
          return Promise.resolve({ data: null, error: null });
        },
        insert: (row: any) => {
          if (table === 'payout_provider_attempts') {
            calls.attemptInserts.push(row);
            if (opts.attemptInsertError) return Promise.resolve({ error: opts.attemptInsertError });
            attempts.push({ attemptStatus: row.attemptStatus });
            return Promise.resolve({ error: null });
          }
          if (table === 'payout_events') {
            calls.eventInserts.push(row);
            if (opts.eventInsertError) return Promise.resolve({ error: opts.eventInsertError });
            if (row.providerEventId) {
              const key = `${row.provider}:${row.providerEventId}`;
              if (recordedEventKeys.has(key)) {
                return Promise.resolve({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } });
              }
              recordedEventKeys.add(key);
            }
            return Promise.resolve({ error: null });
          }
          if (table === 'payment_reconciliation_records') {
            calls.reconciliationInserts.push(row);
            return Promise.resolve({ error: null });
          }
          if (table === 'payout_manual_actions') {
            calls.manualActionInserts.push(row);
            return Promise.resolve({ error: null });
          }
          return Promise.resolve({ error: null });
        },
        update: (row: any) => {
          if (table === 'driver_payouts') {
            calls.payoutUpdates.push(row);
            if (opts.payout) Object.assign(opts.payout, row);
          }
          if (table === 'driver_bank_accounts') {
            calls.bankAccountUpdates.push(row);
            if (opts.bankAccount) Object.assign(opts.bankAccount, row);
          }
          if (table === 'payout_provider_attempts') {
            calls.attemptUpdates.push(row);
            const inFlight = attempts.find((a) => a.attemptStatus === 'call_initiated');
            if (inFlight && row.attemptStatus) inFlight.attemptStatus = row.attemptStatus;
          }
          return builder;
        },
        then: (resolve: any) =>
          Promise.resolve(
            table === 'payout_provider_attempts' ? { data: attempts, error: null } : { data: null, error: null }
          ).then(resolve),
      };
      return builder;
    },
  };

  return { supabaseAdmin, calls };
}

function basePayout(overrides: Partial<MockPayout> = {}): MockPayout {
  return {
    id: 'payout-1',
    driverId: 'driver-1',
    amount: 5000,
    bankAccountId: 'bank-1',
    status: 'pending',
    provider: null,
    providerTransferReference: null,
    providerTransferCode: null,
    ...overrides,
  };
}

function baseBankAccount(overrides: Partial<MockBankAccount> = {}): MockBankAccount {
  return {
    id: 'bank-1',
    bankName: 'GTBank',
    accountName: 'Jane Driver',
    accountNumberEncrypted: null,
    bankCode: '058',
    paystackRecipientCode: 'RCP_cached',
    recipientVerifiedAt: null,
    ...overrides,
  };
}

describe('initiateAutomaticPayout (Paystack — dormant, still covered)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('happy path: cached bank code + recipient -> transfer created -> status processing, never completed', async () => {
    vi.spyOn(payoutProvider, 'initiatePaystackTransfer').mockResolvedValue({
      ok: true, outcome: 'created', providerTransferCode: 'TRF_1', providerState: 'pending', httpStatus: 200, message: '', raw: {},
    });
    const payout = basePayout({ provider: 'paystack' });
    const bankAccount = baseBankAccount();
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout, bankAccount });

    await initiateAutomaticPayout(supabaseAdmin, payout.id);

    expect(payout.status).toBe('processing');
    expect(payout.providerTransferCode).toBe('TRF_1');
    expect(payout.provider).toBe('paystack');
    expect(calls.attemptInserts).toHaveLength(1);
    expect(calls.eventInserts.some((e) => e.eventType === 'transfer_initiated')).toBe(true);
    // "transfer created" must never itself mark the payout completed.
    expect(payout.status).not.toBe('completed');
  });

  it('a second, concurrent initiation attempt is blocked at the DB layer and never calls the provider twice', async () => {
    const transferSpy = vi.spyOn(payoutProvider, 'initiatePaystackTransfer');
    const payout = basePayout({ provider: 'paystack' });
    const bankAccount = baseBankAccount();
    const { supabaseAdmin } = createPayoutSupabaseMock({
      payout, bankAccount, attemptInsertError: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });

    await initiateAutomaticPayout(supabaseAdmin, payout.id);

    expect(transferSpy).not.toHaveBeenCalled();
    expect(payout.status).toBe('pending'); // untouched — the in-flight attempt (or a later reconciliation pass) owns the outcome
  });

  it('a clear provider rejection moves the payout to manual_review with an audit row, never to failed', async () => {
    vi.spyOn(payoutProvider, 'initiatePaystackTransfer').mockResolvedValue({
      ok: false, outcome: 'rejected', providerTransferCode: null, providerState: 'unknown', httpStatus: 400, message: 'Insufficient balance in your Paystack account', raw: {},
    });
    const payout = basePayout({ provider: 'paystack' });
    const bankAccount = baseBankAccount();
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout, bankAccount });

    await initiateAutomaticPayout(supabaseAdmin, payout.id);

    expect(payout.status).toBe('manual_review');
    expect(calls.manualActionInserts).toHaveLength(1);
    expect(calls.manualActionInserts[0].action).toBe('moved_to_manual_review');
  });

  it('a network timeout triggers a provider status re-check rather than blindly retrying or failing', async () => {
    vi.spyOn(payoutProvider, 'initiatePaystackTransfer').mockResolvedValue({
      ok: false, outcome: 'network_error', providerTransferCode: null, providerState: 'unknown', httpStatus: null, message: 'Network error', raw: null,
    });
    const verifySpy = vi.spyOn(payoutProvider, 'verifyPaystackTransfer').mockResolvedValue({
      found: false, providerState: 'unknown', amount: null, providerTransferCode: null, message: 'not found', raw: null,
    });
    const payout = basePayout({ provider: 'paystack' });
    const bankAccount = baseBankAccount();
    const { supabaseAdmin } = createPayoutSupabaseMock({ payout, bankAccount });

    await initiateAutomaticPayout(supabaseAdmin, payout.id);

    expect(verifySpy).toHaveBeenCalledTimes(1);
    // Not found even after checking -> genuinely never reached the provider -> safe to flag, not to blindly retry-create.
    expect(payout.status).toBe('manual_review');
  });

  it('no bank account on file -> manual_review, provider never called', async () => {
    const transferSpy = vi.spyOn(payoutProvider, 'initiatePaystackTransfer');
    const payout = basePayout({ provider: 'paystack' });
    const { supabaseAdmin } = createPayoutSupabaseMock({ payout, bankAccount: null });

    await initiateAutomaticPayout(supabaseAdmin, payout.id);

    expect(transferSpy).not.toHaveBeenCalled();
    expect(payout.status).toBe('manual_review');
  });

  it('an unresolvable bank name falls back to manual_review instead of guessing a bank code', async () => {
    const transferSpy = vi.spyOn(payoutProvider, 'initiatePaystackTransfer');
    const payout = basePayout({ provider: 'paystack' });
    const bankAccount = baseBankAccount({ bankName: 'My Local Cooperative Society', bankCode: null });
    const { supabaseAdmin } = createPayoutSupabaseMock({ payout, bankAccount });

    await initiateAutomaticPayout(supabaseAdmin, payout.id);

    expect(transferSpy).not.toHaveBeenCalled();
    expect(payout.status).toBe('manual_review');
  });
});

describe('moveToManualReview', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('refuses to move a terminal (completed) payout into manual_review', async () => {
    const payout = basePayout({ status: 'completed' });
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout });

    await moveToManualReview(supabaseAdmin, payout.id, 'test reason');

    expect(payout.status).toBe('completed'); // unchanged
    expect(calls.payoutUpdates).toHaveLength(0);
    expect(calls.manualActionInserts).toHaveLength(0);
  });

  it('is a no-op (but not an error) if already in manual_review', async () => {
    const payout = basePayout({ status: 'manual_review' });
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout });

    await moveToManualReview(supabaseAdmin, payout.id, 'test reason');

    expect(calls.payoutUpdates).toHaveLength(0);
  });

  it('records adminUserId=null for a system-triggered move, and a real id for an admin-triggered one', async () => {
    const systemPayout = basePayout({ id: 'p-sys', status: 'processing' });
    const { supabaseAdmin: sysDb, calls: sysCalls } = createPayoutSupabaseMock({ payout: systemPayout });
    await moveToManualReview(sysDb, systemPayout.id, 'automatic failure');
    expect(sysCalls.manualActionInserts[0].adminUserId).toBeNull();

    const adminPayout = basePayout({ id: 'p-admin', status: 'processing' });
    const { supabaseAdmin: adminDb, calls: adminCalls } = createPayoutSupabaseMock({ payout: adminPayout });
    await moveToManualReview(adminDb, adminPayout.id, 'admin pulled it', 'admin-42');
    expect(adminCalls.manualActionInserts[0].adminUserId).toBe('admin-42');
  });
});

describe('reconcileOnePayout', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('self-heals: provider confirms success while Pantra is still processing -> completed, no reconciliation record (no money was sent, only recognized)', async () => {
    vi.spyOn(payoutProvider, 'verifyPaystackTransfer').mockResolvedValue({
      found: true, providerState: 'successful', amount: 5000, providerTransferCode: 'TRF_1', message: '', raw: {},
    });
    const payout = basePayout({ status: 'processing', provider: 'paystack', providerTransferReference: 'PANTRA-PAYOUT-1' });
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout });

    const result = await reconcileOnePayout(supabaseAdmin, payout.id);

    expect(result.status).toBe(true);
    expect(payout.status).toBe('completed');
    expect(calls.reconciliationInserts).toHaveLength(0);
  });

  it('an amount mismatch on an otherwise-successful transfer is flagged, never auto-completed', async () => {
    vi.spyOn(payoutProvider, 'verifyPaystackTransfer').mockResolvedValue({
      found: true, providerState: 'successful', amount: 4000, providerTransferCode: 'TRF_1', message: '', raw: {},
    });
    const payout = basePayout({ status: 'processing', amount: 5000, provider: 'paystack', providerTransferReference: 'PANTRA-PAYOUT-1' });
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout });

    const result = await reconcileOnePayout(supabaseAdmin, payout.id);

    expect(result.status).toBe(false);
    expect(payout.status).toBe('manual_review');
    expect(calls.reconciliationInserts[0].mismatchType).toBe('payout_amount_mismatch');
  });

  it('provider confirms failure while processing -> failed, releasing the reservation', async () => {
    vi.spyOn(payoutProvider, 'verifyPaystackTransfer').mockResolvedValue({
      found: true, providerState: 'failed', amount: null, providerTransferCode: 'TRF_1', message: '', raw: {},
    });
    const payout = basePayout({ status: 'processing', provider: 'paystack', providerTransferReference: 'PANTRA-PAYOUT-1' });
    const { supabaseAdmin } = createPayoutSupabaseMock({ payout });

    await reconcileOnePayout(supabaseAdmin, payout.id);

    expect(payout.status).toBe('failed');
  });

  it('a reversal is only ever applied from completed, and is recorded for visibility', async () => {
    vi.spyOn(payoutProvider, 'verifyPaystackTransfer').mockResolvedValue({
      found: true, providerState: 'reversed', amount: 5000, providerTransferCode: 'TRF_1', message: '', raw: {},
    });
    const payout = basePayout({ status: 'completed', provider: 'paystack', providerTransferReference: 'PANTRA-PAYOUT-1' });
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout });

    await reconcileOnePayout(supabaseAdmin, payout.id);

    expect(payout.status).toBe('reversed');
    expect(calls.reconciliationInserts[0].mismatchType).toBe('payout_provider_reversed');
  });

  it('provider has no record at all -> manual_review + an unmatched reconciliation record, never a blind retry', async () => {
    vi.spyOn(payoutProvider, 'verifyPaystackTransfer').mockResolvedValue({
      found: false, providerState: 'unknown', amount: null, providerTransferCode: null, message: 'not found', raw: null,
    });
    const payout = basePayout({ status: 'processing', provider: 'paystack', providerTransferReference: 'PANTRA-PAYOUT-1' });
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout });

    await reconcileOnePayout(supabaseAdmin, payout.id);

    expect(payout.status).toBe('manual_review');
    expect(calls.reconciliationInserts[0].mismatchType).toBe('payout_unmatched_provider_transaction');
  });
});

describe('processPayoutWebhookEvent', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('an unmatched transfer reference is recorded (event + reconciliation) without crashing', async () => {
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout: null });

    await processPayoutWebhookEvent(supabaseAdmin, 'paystack', { event: 'transfer.success', data: { reference: 'PANTRA-PAYOUT-unknown', id: 1, amount: 500000 } });

    expect(calls.eventInserts[0].processingStatus).toBe('rejected_unmatched_payout');
    expect(calls.reconciliationInserts[0].mismatchType).toBe('payout_unmatched_provider_transaction');
  });

  it('an event for an already-terminal payout is ignored as a duplicate, no transition attempted', async () => {
    const payout = basePayout({ status: 'completed', providerTransferReference: 'PANTRA-PAYOUT-1' });
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout });

    await processPayoutWebhookEvent(supabaseAdmin, 'paystack', { event: 'transfer.success', data: { reference: 'PANTRA-PAYOUT-1', id: 2, amount: 500000 } });

    expect(calls.eventInserts[0].processingStatus).toBe('ignored_duplicate');
    expect(calls.payoutUpdates).toHaveLength(0);
  });

  it('transfer.success with a matching amount completes the payout', async () => {
    const payout = basePayout({ status: 'processing', amount: 5000, providerTransferReference: 'PANTRA-PAYOUT-1' });
    const { supabaseAdmin } = createPayoutSupabaseMock({ payout });

    await processPayoutWebhookEvent(supabaseAdmin, 'paystack', { event: 'transfer.success', data: { reference: 'PANTRA-PAYOUT-1', id: 3, amount: 500000 } });

    expect(payout.status).toBe('completed');
  });

  it('transfer.success with a mismatched amount flags manual_review instead of completing', async () => {
    const payout = basePayout({ status: 'processing', amount: 5000, providerTransferReference: 'PANTRA-PAYOUT-1' });
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout });

    await processPayoutWebhookEvent(supabaseAdmin, 'paystack', { event: 'transfer.success', data: { reference: 'PANTRA-PAYOUT-1', id: 4, amount: 400000 } });

    expect(payout.status).toBe('manual_review');
    expect(calls.reconciliationInserts[0].mismatchType).toBe('payout_amount_mismatch');
  });

  it('transfer.failed marks the payout failed', async () => {
    const payout = basePayout({ status: 'processing', providerTransferReference: 'PANTRA-PAYOUT-1' });
    const { supabaseAdmin } = createPayoutSupabaseMock({ payout });

    await processPayoutWebhookEvent(supabaseAdmin, 'paystack', { event: 'transfer.failed', data: { reference: 'PANTRA-PAYOUT-1', id: 5 } });

    expect(payout.status).toBe('failed');
  });

  it('20 duplicate deliveries of the same event apply exactly one transition, not twenty', async () => {
    const payout = basePayout({ status: 'processing', amount: 5000, providerTransferReference: 'PANTRA-PAYOUT-1' });
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout });

    for (let i = 0; i < 20; i++) {
      await processPayoutWebhookEvent(supabaseAdmin, 'paystack', { event: 'transfer.success', data: { reference: 'PANTRA-PAYOUT-1', id: 999, amount: 500000 } });
    }

    // The first delivery completes the payout; every one of the other 19
    // hits the (provider, providerEventId) unique index (or, once terminal,
    // the terminal short-circuit) and is swallowed as a duplicate — never a
    // second status mutation.
    expect(payout.status).toBe('completed');
    expect(calls.payoutUpdates.filter((u) => u.status === 'completed')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Flutterwave — the active payout provider (DRIVER_PAYOUT_CONFIG.provider)
// ---------------------------------------------------------------------------

function fwBankAccount(overrides: Partial<MockBankAccount> = {}): MockBankAccount {
  return baseBankAccount({ paystackRecipientCode: null, accountNumberEncrypted: encryptAccountNumber('0690000032'), recipientVerifiedAt: '2026-01-01T00:00:00.000Z', ...overrides });
}

const fwCreated = {
  ok: true, outcome: 'created' as const, providerTransferCode: '26251', providerState: 'pending' as const, httpStatus: 200, message: '', raw: {},
};

function fwVerify(overrides: Partial<Awaited<ReturnType<typeof flutterwaveProvider.verifyFlutterwaveTransfer>>> = {}) {
  return {
    found: true, providerState: 'successful' as const, amount: 5000, providerTransferCode: '26251', reference: 'PANTRA-PAYOUT-1', message: '', raw: {},
    ...overrides,
  };
}

describe('initiateAutomaticPayout (Flutterwave — active default)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('a fresh payout defaults to Flutterwave, sends naira as-is with the raw account number, and stops at processing', async () => {
    const fwSpy = vi.spyOn(flutterwaveProvider, 'initiateFlutterwaveTransfer').mockResolvedValue(fwCreated);
    const paystackSpy = vi.spyOn(payoutProvider, 'initiatePaystackTransfer');
    const payout = basePayout(); // provider: null
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout, bankAccount: fwBankAccount() });

    await initiateAutomaticPayout(supabaseAdmin, payout.id);

    expect(paystackSpy).not.toHaveBeenCalled();
    expect(fwSpy).toHaveBeenCalledWith(expect.objectContaining({ amount: 5000, accountNumber: '0690000032', bankCode: '058' }));
    expect(payout.provider).toBe('flutterwave');
    expect(payout.status).toBe('processing');
    expect(payout.providerTransferCode).toBe('26251'); // Flutterwave's own id, needed later for verification
    expect(calls.attemptInserts[0].provider).toBe('flutterwave');
    expect(calls.eventInserts.find((e) => e.eventType === 'transfer_initiated')?.provider).toBe('flutterwave');
  });

  it('a Kuda driver gets Flutterwave\'s Kuda code, never the cached Paystack code from driver_bank_accounts.bankCode', async () => {
    const fwSpy = vi.spyOn(flutterwaveProvider, 'initiateFlutterwaveTransfer').mockResolvedValue(fwCreated);
    const payout = basePayout();
    // bankCode cached as Paystack's Kuda code (e.g. from an earlier Paystack-era add).
    const bankAccount = fwBankAccount({ bankName: 'Kuda', bankCode: '50211' });
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout, bankAccount });

    await initiateAutomaticPayout(supabaseAdmin, payout.id);

    expect(fwSpy).toHaveBeenCalledWith(expect.objectContaining({ bankCode: '090267' }));
    // The Paystack cache column is left untouched by the Flutterwave path.
    expect(calls.bankAccountUpdates.some((u) => 'bankCode' in u)).toBe(false);
    expect(bankAccount.bankCode).toBe('50211');
  });

  it('a retry of a payout already assigned to Paystack keeps Paystack (a payout never switches providers mid-flight)', async () => {
    const fwSpy = vi.spyOn(flutterwaveProvider, 'initiateFlutterwaveTransfer');
    vi.spyOn(payoutProvider, 'initiatePaystackTransfer').mockResolvedValue({
      ok: true, outcome: 'created', providerTransferCode: 'TRF_1', providerState: 'pending', httpStatus: 200, message: '', raw: {},
    });
    const payout = basePayout({ status: 'processing', provider: 'paystack', providerTransferReference: 'PANTRA-PAYOUT-1' });
    const { supabaseAdmin } = createPayoutSupabaseMock({ payout, bankAccount: baseBankAccount() });

    await initiateAutomaticPayout(supabaseAdmin, payout.id);

    expect(fwSpy).not.toHaveBeenCalled();
    expect(payout.provider).toBe('paystack');
  });

  it('an unverified bank account is verified with /v3/accounts/resolve first, and the verification is recorded', async () => {
    const resolveSpy = vi.spyOn(flutterwaveProvider, 'resolveFlutterwaveAccountName').mockResolvedValue({
      ok: true, resolvedAccountName: 'Jane Driver', message: '', raw: {},
    });
    vi.spyOn(flutterwaveProvider, 'initiateFlutterwaveTransfer').mockResolvedValue(fwCreated);
    const payout = basePayout();
    const bankAccount = fwBankAccount({ recipientVerifiedAt: null });
    const { supabaseAdmin } = createPayoutSupabaseMock({ payout, bankAccount });

    await initiateAutomaticPayout(supabaseAdmin, payout.id);

    expect(resolveSpy).toHaveBeenCalledWith({ accountNumber: '0690000032', bankCode: '058' });
    expect(bankAccount.recipientVerifiedAt).not.toBeNull();
    expect(payout.status).toBe('processing');
  });

  it('an already-verified bank account is not re-resolved on every payout', async () => {
    const resolveSpy = vi.spyOn(flutterwaveProvider, 'resolveFlutterwaveAccountName');
    vi.spyOn(flutterwaveProvider, 'initiateFlutterwaveTransfer').mockResolvedValue(fwCreated);
    const payout = basePayout();
    const { supabaseAdmin } = createPayoutSupabaseMock({ payout, bankAccount: fwBankAccount() });

    await initiateAutomaticPayout(supabaseAdmin, payout.id);

    expect(resolveSpy).not.toHaveBeenCalled();
  });

  it('a bank account Flutterwave cannot resolve goes to manual_review and no transfer is attempted', async () => {
    vi.spyOn(flutterwaveProvider, 'resolveFlutterwaveAccountName').mockResolvedValue({
      ok: false, resolvedAccountName: null, message: 'Sorry, that account number is invalid', raw: {},
    });
    const transferSpy = vi.spyOn(flutterwaveProvider, 'initiateFlutterwaveTransfer');
    const payout = basePayout();
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout, bankAccount: fwBankAccount({ recipientVerifiedAt: null }) });

    await initiateAutomaticPayout(supabaseAdmin, payout.id);

    expect(transferSpy).not.toHaveBeenCalled();
    expect(payout.status).toBe('manual_review');
    expect(calls.manualActionInserts[0].notes).toContain('Sorry, that account number is invalid');
  });

  it('a clear Flutterwave rejection moves the payout to manual_review, never to failed', async () => {
    vi.spyOn(flutterwaveProvider, 'initiateFlutterwaveTransfer').mockResolvedValue({
      ok: false, outcome: 'rejected', providerTransferCode: null, providerState: 'unknown', httpStatus: 400, message: 'Insufficient balance', raw: {},
    });
    const payout = basePayout();
    const { supabaseAdmin } = createPayoutSupabaseMock({ payout, bankAccount: fwBankAccount() });

    await initiateAutomaticPayout(supabaseAdmin, payout.id);

    expect(payout.status).toBe('manual_review');
  });

  it('a network timeout leaves no Flutterwave id to look up, so it goes to manual review instead of a guess or a blind retry', async () => {
    vi.spyOn(flutterwaveProvider, 'initiateFlutterwaveTransfer').mockResolvedValue({
      ok: false, outcome: 'network_error', providerTransferCode: null, providerState: 'unknown', httpStatus: null, message: 'Network error', raw: null,
    });
    const verifySpy = vi.spyOn(flutterwaveProvider, 'verifyFlutterwaveTransfer');
    const payout = basePayout();
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout, bankAccount: fwBankAccount() });

    await initiateAutomaticPayout(supabaseAdmin, payout.id);

    expect(verifySpy).not.toHaveBeenCalled();
    expect(payout.status).toBe('manual_review');
    expect(calls.reconciliationInserts[0].mismatchType).toBe('payout_unresolved_after_timeout');
  });
});

describe('reconcileOnePayout (Flutterwave)', () => {
  beforeEach(() => vi.restoreAllMocks());

  const fwPayout = (overrides: Partial<MockPayout> = {}) =>
    basePayout({ status: 'processing', provider: 'flutterwave', providerTransferReference: 'PANTRA-PAYOUT-1', providerTransferCode: '26251', ...overrides });

  it('looks up by Flutterwave transfer id (not the Pantra reference) and completes on a confirmed success', async () => {
    const verifySpy = vi.spyOn(flutterwaveProvider, 'verifyFlutterwaveTransfer').mockResolvedValue(fwVerify());
    const paystackSpy = vi.spyOn(payoutProvider, 'verifyPaystackTransfer');
    const payout = fwPayout();
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout });

    const result = await reconcileOnePayout(supabaseAdmin, payout.id);

    expect(verifySpy).toHaveBeenCalledWith('26251');
    expect(paystackSpy).not.toHaveBeenCalled();
    expect(result.status).toBe(true);
    expect(payout.status).toBe('completed');
    expect(calls.eventInserts[0].provider).toBe('flutterwave');
  });

  it('a transfer carrying a different reference is never applied to this payout', async () => {
    vi.spyOn(flutterwaveProvider, 'verifyFlutterwaveTransfer').mockResolvedValue(fwVerify({ reference: 'SOMEONE-ELSES-REF' }));
    const payout = fwPayout();
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout });

    await reconcileOnePayout(supabaseAdmin, payout.id);

    expect(payout.status).toBe('manual_review');
    expect(calls.reconciliationInserts[0].mismatchType).toBe('payout_unmatched_provider_transaction');
  });

  it('a confirmed failure marks the payout failed', async () => {
    vi.spyOn(flutterwaveProvider, 'verifyFlutterwaveTransfer').mockResolvedValue(fwVerify({ providerState: 'failed' }));
    const payout = fwPayout();
    const { supabaseAdmin } = createPayoutSupabaseMock({ payout });

    await reconcileOnePayout(supabaseAdmin, payout.id);

    expect(payout.status).toBe('failed');
  });

  it('an amount mismatch on a successful transfer is flagged, never auto-completed', async () => {
    vi.spyOn(flutterwaveProvider, 'verifyFlutterwaveTransfer').mockResolvedValue(fwVerify({ amount: 4000 }));
    const payout = fwPayout();
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout });

    await reconcileOnePayout(supabaseAdmin, payout.id);

    expect(payout.status).toBe('manual_review');
    expect(calls.reconciliationInserts[0].mismatchType).toBe('payout_amount_mismatch');
  });

  it('pending (NEW/PENDING) applies no transition', async () => {
    vi.spyOn(flutterwaveProvider, 'verifyFlutterwaveTransfer').mockResolvedValue(fwVerify({ providerState: 'pending' }));
    const payout = fwPayout();
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout });

    await reconcileOnePayout(supabaseAdmin, payout.id);

    expect(payout.status).toBe('processing');
    expect(calls.payoutUpdates).toHaveLength(0);
  });

  it('no captured id + a timed-out attempt: a transfer may exist, so it hands off to manual review and flags it unverifiable', async () => {
    const verifySpy = vi.spyOn(flutterwaveProvider, 'verifyFlutterwaveTransfer');
    const payout = fwPayout({ providerTransferCode: null });
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout, attempts: [{ attemptStatus: 'call_timeout' }] });

    const result = await reconcileOnePayout(supabaseAdmin, payout.id);

    expect(verifySpy).not.toHaveBeenCalled();
    expect(result.status).toBe(false);
    expect(result.unverifiable).toBe(true);
    expect(payout.status).toBe('manual_review');
    expect(calls.reconciliationInserts[0].mismatchType).toBe('payout_unresolved_after_timeout');
  });

  it('an ambiguous payout already in review is still flagged unverifiable, without piling up duplicate reconciliation records', async () => {
    const payout = fwPayout({ status: 'manual_review', providerTransferCode: null });
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout, attempts: [{ attemptStatus: 'call_failed_duplicate_reference' }] });

    const result = await reconcileOnePayout(supabaseAdmin, payout.id);

    expect(result.unverifiable).toBe(true);
    expect(calls.reconciliationInserts).toHaveLength(0);
  });

  it('every attempt rejected outright (e.g. IP whitelisting): nothing was sent, so no reconciliation noise and safe to pay manually', async () => {
    const verifySpy = vi.spyOn(flutterwaveProvider, 'verifyFlutterwaveTransfer');
    const payout = fwPayout({ status: 'manual_review', providerTransferCode: null });
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({
      payout,
      attempts: [{ attemptStatus: 'call_rejected' }, { attemptStatus: 'call_rejected' }],
    });

    const result = await reconcileOnePayout(supabaseAdmin, payout.id);

    expect(verifySpy).not.toHaveBeenCalled();
    expect(result.unverifiable).toBeFalsy();
    expect(calls.reconciliationInserts).toHaveLength(0);
    expect(payout.status).toBe('manual_review');
  });

  it('a payout stuck in processing whose attempts were all rejected is moved to review rather than left stuck forever', async () => {
    const payout = fwPayout({ status: 'processing', providerTransferCode: null });
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout, attempts: [{ attemptStatus: 'call_rejected' }] });

    await reconcileOnePayout(supabaseAdmin, payout.id);

    expect(payout.status).toBe('manual_review');
    expect(calls.reconciliationInserts).toHaveLength(0);
  });
});

describe('flutterwaveTransferMayExist', () => {
  it('only a clean provider rejection proves no transfer was created', () => {
    expect(flutterwaveTransferMayExist([])).toBe(false);
    expect(flutterwaveTransferMayExist(['call_rejected'])).toBe(false);
    expect(flutterwaveTransferMayExist(['call_rejected', 'call_rejected'])).toBe(false);
  });

  it('any in-flight, timed-out, network-failed, duplicate or id-less success attempt means a transfer may exist', () => {
    for (const status of ['call_initiated', 'call_timeout', 'call_failed_network', 'call_failed_duplicate_reference', 'call_succeeded']) {
      expect(flutterwaveTransferMayExist(['call_rejected', status])).toBe(true);
    }
  });
});

describe('initiateAutomaticPayout -> manual review when Flutterwave refuses (current production state)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('an IP-whitelisting rejection lands the payout in manual review with the real reason, safe to pay manually', async () => {
    vi.spyOn(flutterwaveProvider, 'initiateFlutterwaveTransfer').mockResolvedValue({
      ok: false, outcome: 'rejected', providerTransferCode: null, providerState: 'unknown', httpStatus: 400,
      message: 'Please enable IP Whitelisting to access this service', raw: {},
    });
    const payout = basePayout();
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout, bankAccount: fwBankAccount() });

    await initiateAutomaticPayout(supabaseAdmin, payout.id);

    expect(payout.status).toBe('manual_review');
    expect(calls.manualActionInserts[0].notes).toContain('IP Whitelisting');
    expect(calls.reconciliationInserts).toHaveLength(0);

    // The pre-completion re-check an admin's "Complete manually" triggers:
    const check = await reconcileOnePayout(supabaseAdmin, payout.id);
    expect(check.unverifiable).toBeFalsy();
    expect(calls.reconciliationInserts).toHaveLength(0);
  });
});

describe('processPayoutWebhookEvent (Flutterwave transfer.completed)', () => {
  beforeEach(() => vi.restoreAllMocks());

  const webhook = (data: Record<string, unknown>) => ({
    event: 'transfer.completed',
    data: { id: 26251, reference: 'PANTRA-PAYOUT-1', amount: 5000, currency: 'NGN', status: 'SUCCESSFUL', ...data },
  });

  const processingFwPayout = () =>
    basePayout({ status: 'processing', provider: 'flutterwave', providerTransferReference: 'PANTRA-PAYOUT-1', providerTransferCode: '26251' });

  it('a SUCCESSFUL notification completes the payout only after the live API confirms it', async () => {
    const verifySpy = vi.spyOn(flutterwaveProvider, 'verifyFlutterwaveTransfer').mockResolvedValue(fwVerify());
    const payout = processingFwPayout();
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout });

    await processPayoutWebhookEvent(supabaseAdmin, 'flutterwave', webhook({}));

    expect(verifySpy).toHaveBeenCalledWith('26251');
    expect(payout.status).toBe('completed');
    expect(calls.eventInserts[0].amount).toBe(5000); // naira as reported, no kobo division
    expect(calls.eventInserts[0].provider).toBe('flutterwave');
  });

  it('a forged FAILED payload cannot release the reservation when Flutterwave itself says the transfer succeeded', async () => {
    vi.spyOn(flutterwaveProvider, 'verifyFlutterwaveTransfer').mockResolvedValue(fwVerify({ providerState: 'successful' }));
    const payout = processingFwPayout();
    const { supabaseAdmin } = createPayoutSupabaseMock({ payout });

    await processPayoutWebhookEvent(supabaseAdmin, 'flutterwave', webhook({ status: 'FAILED' }));

    expect(payout.status).toBe('completed');
  });

  it('a FAILED outcome confirmed by the API marks the payout failed', async () => {
    vi.spyOn(flutterwaveProvider, 'verifyFlutterwaveTransfer').mockResolvedValue(fwVerify({ providerState: 'failed' }));
    const payout = processingFwPayout();
    const { supabaseAdmin } = createPayoutSupabaseMock({ payout });

    await processPayoutWebhookEvent(supabaseAdmin, 'flutterwave', webhook({ status: 'FAILED' }));

    expect(payout.status).toBe('failed');
  });

  it('self-heals a payout whose create response was lost: the webhook id is verified, then persisted', async () => {
    const verifySpy = vi.spyOn(flutterwaveProvider, 'verifyFlutterwaveTransfer').mockResolvedValue(fwVerify());
    const payout = basePayout({ status: 'manual_review', provider: 'flutterwave', providerTransferReference: 'PANTRA-PAYOUT-1', providerTransferCode: null });
    const { supabaseAdmin } = createPayoutSupabaseMock({ payout });

    await processPayoutWebhookEvent(supabaseAdmin, 'flutterwave', webhook({}));

    expect(verifySpy).toHaveBeenCalledWith('26251');
    expect(payout.providerTransferCode).toBe('26251');
    expect(payout.status).toBe('completed');
  });

  it('a webhook-supplied id pointing at a different transfer is neither persisted nor applied', async () => {
    vi.spyOn(flutterwaveProvider, 'verifyFlutterwaveTransfer').mockResolvedValue(fwVerify({ reference: 'SOMEONE-ELSES-REF' }));
    const payout = basePayout({ status: 'manual_review', provider: 'flutterwave', providerTransferReference: 'PANTRA-PAYOUT-1', providerTransferCode: null });
    const { supabaseAdmin } = createPayoutSupabaseMock({ payout });

    await processPayoutWebhookEvent(supabaseAdmin, 'flutterwave', webhook({ id: 77777 }));

    expect(payout.providerTransferCode).toBeNull();
    expect(payout.status).toBe('manual_review');
  });

  it('dedup keys on id + status: 20 identical deliveries apply once, but a later status for the same transfer is not swallowed', async () => {
    const verifySpy = vi.spyOn(flutterwaveProvider, 'verifyFlutterwaveTransfer').mockResolvedValue(fwVerify({ providerState: 'pending' }));
    const payout = processingFwPayout();
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout });

    for (let i = 0; i < 20; i++) {
      await processPayoutWebhookEvent(supabaseAdmin, 'flutterwave', webhook({ status: 'PENDING' }));
    }
    expect(verifySpy).toHaveBeenCalledTimes(1);

    verifySpy.mockResolvedValue(fwVerify({ providerState: 'successful' }));
    await processPayoutWebhookEvent(supabaseAdmin, 'flutterwave', webhook({ status: 'SUCCESSFUL' }));

    expect(payout.status).toBe('completed');
    expect(calls.payoutUpdates.filter((u) => u.status === 'completed')).toHaveLength(1);
  });

  it('an unmatched reference is recorded against Flutterwave without calling the API', async () => {
    const verifySpy = vi.spyOn(flutterwaveProvider, 'verifyFlutterwaveTransfer');
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout: null });

    await processPayoutWebhookEvent(supabaseAdmin, 'flutterwave', webhook({ reference: 'PANTRA-PAYOUT-unknown' }));

    expect(verifySpy).not.toHaveBeenCalled();
    expect(calls.eventInserts[0].processingStatus).toBe('rejected_unmatched_payout');
    expect(calls.reconciliationInserts[0].provider).toBe('flutterwave');
  });
});
