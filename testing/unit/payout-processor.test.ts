import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as payoutProvider from '@/backend/lib/payout-provider';
import {
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
  accountNumber: string | null;
  bankCode: string | null;
  paystackRecipientCode: string | null;
}

function createPayoutSupabaseMock(opts: {
  payout: MockPayout | null;
  bankAccount?: MockBankAccount | null;
  attemptInsertError?: { code: string; message: string } | null;
  eventInsertError?: { code: string; message: string } | null;
}) {
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
          }
          return builder;
        },
        then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
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
    accountNumber: null,
    bankCode: '058',
    paystackRecipientCode: 'RCP_cached',
    ...overrides,
  };
}

describe('initiateAutomaticPayout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('happy path: cached bank code + recipient -> transfer created -> status processing, never completed', async () => {
    vi.spyOn(payoutProvider, 'initiatePaystackTransfer').mockResolvedValue({
      ok: true, outcome: 'created', providerTransferCode: 'TRF_1', providerState: 'pending', httpStatus: 200, message: '', raw: {},
    });
    const payout = basePayout();
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
    const payout = basePayout();
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
    const payout = basePayout();
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
    const payout = basePayout();
    const bankAccount = baseBankAccount();
    const { supabaseAdmin } = createPayoutSupabaseMock({ payout, bankAccount });

    await initiateAutomaticPayout(supabaseAdmin, payout.id);

    expect(verifySpy).toHaveBeenCalledTimes(1);
    // Not found even after checking -> genuinely never reached the provider -> safe to flag, not to blindly retry-create.
    expect(payout.status).toBe('manual_review');
  });

  it('no bank account on file -> manual_review, provider never called', async () => {
    const transferSpy = vi.spyOn(payoutProvider, 'initiatePaystackTransfer');
    const payout = basePayout();
    const { supabaseAdmin } = createPayoutSupabaseMock({ payout, bankAccount: null });

    await initiateAutomaticPayout(supabaseAdmin, payout.id);

    expect(transferSpy).not.toHaveBeenCalled();
    expect(payout.status).toBe('manual_review');
  });

  it('an unresolvable bank name falls back to manual_review instead of guessing a bank code', async () => {
    const transferSpy = vi.spyOn(payoutProvider, 'initiatePaystackTransfer');
    const payout = basePayout();
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

    await processPayoutWebhookEvent(supabaseAdmin, { event: 'transfer.success', data: { reference: 'PANTRA-PAYOUT-unknown', id: 1, amount: 500000 } });

    expect(calls.eventInserts[0].processingStatus).toBe('rejected_unmatched_payout');
    expect(calls.reconciliationInserts[0].mismatchType).toBe('payout_unmatched_provider_transaction');
  });

  it('an event for an already-terminal payout is ignored as a duplicate, no transition attempted', async () => {
    const payout = basePayout({ status: 'completed', providerTransferReference: 'PANTRA-PAYOUT-1' });
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout });

    await processPayoutWebhookEvent(supabaseAdmin, { event: 'transfer.success', data: { reference: 'PANTRA-PAYOUT-1', id: 2, amount: 500000 } });

    expect(calls.eventInserts[0].processingStatus).toBe('ignored_duplicate');
    expect(calls.payoutUpdates).toHaveLength(0);
  });

  it('transfer.success with a matching amount completes the payout', async () => {
    const payout = basePayout({ status: 'processing', amount: 5000, providerTransferReference: 'PANTRA-PAYOUT-1' });
    const { supabaseAdmin } = createPayoutSupabaseMock({ payout });

    await processPayoutWebhookEvent(supabaseAdmin, { event: 'transfer.success', data: { reference: 'PANTRA-PAYOUT-1', id: 3, amount: 500000 } });

    expect(payout.status).toBe('completed');
  });

  it('transfer.success with a mismatched amount flags manual_review instead of completing', async () => {
    const payout = basePayout({ status: 'processing', amount: 5000, providerTransferReference: 'PANTRA-PAYOUT-1' });
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout });

    await processPayoutWebhookEvent(supabaseAdmin, { event: 'transfer.success', data: { reference: 'PANTRA-PAYOUT-1', id: 4, amount: 400000 } });

    expect(payout.status).toBe('manual_review');
    expect(calls.reconciliationInserts[0].mismatchType).toBe('payout_amount_mismatch');
  });

  it('transfer.failed marks the payout failed', async () => {
    const payout = basePayout({ status: 'processing', providerTransferReference: 'PANTRA-PAYOUT-1' });
    const { supabaseAdmin } = createPayoutSupabaseMock({ payout });

    await processPayoutWebhookEvent(supabaseAdmin, { event: 'transfer.failed', data: { reference: 'PANTRA-PAYOUT-1', id: 5 } });

    expect(payout.status).toBe('failed');
  });

  it('20 duplicate deliveries of the same event apply exactly one transition, not twenty', async () => {
    const payout = basePayout({ status: 'processing', amount: 5000, providerTransferReference: 'PANTRA-PAYOUT-1' });
    const { supabaseAdmin, calls } = createPayoutSupabaseMock({ payout });

    for (let i = 0; i < 20; i++) {
      await processPayoutWebhookEvent(supabaseAdmin, { event: 'transfer.success', data: { reference: 'PANTRA-PAYOUT-1', id: 999, amount: 500000 } });
    }

    // The first delivery completes the payout; every one of the other 19
    // hits the (provider, providerEventId) unique index (or, once terminal,
    // the terminal short-circuit) and is swallowed as a duplicate — never a
    // second status mutation.
    expect(payout.status).toBe('completed');
    expect(calls.payoutUpdates.filter((u) => u.status === 'completed')).toHaveLength(1);
  });
});
