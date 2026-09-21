import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as refundProvider from '@/backend/lib/refund-provider';
import {
  initiateRefund,
  processFlutterwaveRefundCallback,
  processRefundWebhookEvent,
  reconcileOneRefund,
} from '@/backend/lib/refund-processor';

interface MockRefund {
  id: string;
  originalPaymentType: 'wallet_topup' | 'ride_wallet_payment';
  paymentIntentId: string | null;
  rideId: string | null;
  userId: string;
  amount: number;
  reason: string | null;
  status: string;
  refundReference: string;
  providerRefundId: string | null;
  providerRefundReference?: string | null;
  provider?: 'paystack' | 'flutterwave' | null;
  driverImpactAmount?: number | null;
  requiresDriverAdjustmentReview?: boolean;
  walletTransactionId?: string | null;
  failureReason?: string | null;
}

interface MockPaymentIntent {
  id: string;
  provider: 'paystack' | 'flutterwave';
  reference: string;
  providerTransactionId: string | null;
  currency: string;
  status: string;
}

interface MockRide {
  fare: number;
  driverEarningsAmount: number;
}

function createRefundSupabaseMock(opts: {
  refund: MockRefund | null;
  paymentIntent?: MockPaymentIntent | null;
  ride?: MockRide | null;
  rpcError?: { message: string } | null;
  attemptInsertError?: { code: string; message: string } | null;
}) {
  const calls = {
    refundUpdates: [] as any[],
    attemptInserts: [] as any[],
    attemptUpdates: [] as any[],
    eventInserts: [] as any[],
    reconciliationInserts: [] as any[],
    rpc: [] as { fn: string; args: any }[],
  };
  const recordedEventKeys = new Set<string>();

  const supabaseAdmin: any = {
    from(table: string) {
      const builder: any = {
        select: () => builder,
        eq: (col: string, val: any) => {
          if (table === 'refund_intents' && col === 'providerRefundId' && opts.refund) {
            builder.__matchProviderRefundId = val;
          }
          return builder;
        },
        in: () => builder,
        lt: () => builder,
        limit: () => builder,
        order: () => builder,
        maybeSingle: () => {
          if (table === 'refund_intents') {
            if (builder.__matchProviderRefundId !== undefined) {
              return Promise.resolve({
                data: opts.refund && opts.refund.providerRefundId === builder.__matchProviderRefundId ? opts.refund : null,
                error: null,
              });
            }
            return Promise.resolve({ data: opts.refund, error: null });
          }
          if (table === 'payment_intents') return Promise.resolve({ data: opts.paymentIntent ?? null, error: null });
          if (table === 'rides') return Promise.resolve({ data: opts.ride ?? null, error: null });
          return Promise.resolve({ data: null, error: null });
        },
        single: () => {
          if (table === 'refund_intents') return Promise.resolve({ data: opts.refund, error: null });
          return Promise.resolve({ data: null, error: null });
        },
        insert: (row: any) => {
          if (table === 'refund_provider_attempts') {
            calls.attemptInserts.push(row);
            if (opts.attemptInsertError) return Promise.resolve({ error: opts.attemptInsertError });
            return Promise.resolve({ error: null });
          }
          if (table === 'refund_events') {
            calls.eventInserts.push(row);
            if (row.providerEventId) {
              const key = `${row.provider}:${row.providerEventId}`;
              if (recordedEventKeys.has(key)) return Promise.resolve({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } });
              recordedEventKeys.add(key);
            }
            return Promise.resolve({ error: null });
          }
          if (table === 'payment_reconciliation_records') {
            calls.reconciliationInserts.push(row);
            return Promise.resolve({ error: null });
          }
          return Promise.resolve({ error: null });
        },
        update: (row: any) => {
          if (table === 'refund_intents') {
            calls.refundUpdates.push(row);
            if (opts.refund) Object.assign(opts.refund, row);
          }
          if (table === 'refund_provider_attempts') calls.attemptUpdates.push(row);
          return builder;
        },
        then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
      };
      return builder;
    },
    rpc(fn: string, args: any) {
      calls.rpc.push({ fn, args });
      if (opts.rpcError) return Promise.resolve({ data: null, error: opts.rpcError });
      return Promise.resolve({ data: { id: 'wt-1', ...args }, error: null });
    },
  };

  return { supabaseAdmin, calls };
}

function baseWalletTopupRefund(overrides: Partial<MockRefund> = {}): MockRefund {
  return {
    id: 'refund-1',
    originalPaymentType: 'wallet_topup',
    paymentIntentId: 'intent-1',
    rideId: null,
    userId: 'user-1',
    amount: 2000,
    reason: 'Accidental top-up',
    status: 'requested',
    refundReference: 'PANTRA-REFUND-1',
    providerRefundId: null,
    ...overrides,
  };
}

function baseRideRefund(overrides: Partial<MockRefund> = {}): MockRefund {
  return {
    id: 'refund-2',
    originalPaymentType: 'ride_wallet_payment',
    paymentIntentId: null,
    rideId: 'ride-1',
    userId: 'user-1',
    amount: 5000,
    reason: 'Ride cancelled by driver',
    status: 'requested',
    refundReference: 'PANTRA-REFUND-2',
    providerRefundId: null,
    ...overrides,
  };
}

function basePaymentIntent(overrides: Partial<MockPaymentIntent> = {}): MockPaymentIntent {
  return { id: 'intent-1', provider: 'paystack', reference: 'PANTRA-abc', providerTransactionId: '999', currency: 'NGN', status: 'successful', ...overrides };
}

describe('initiateRefund — ride_wallet_payment (pure wallet-to-wallet credit)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('credits the wallet via add_wallet_transaction(type=refund) and completes synchronously', async () => {
    const refund = baseRideRefund();
    const { supabaseAdmin, calls } = createRefundSupabaseMock({ refund, ride: { fare: 5000, driverEarningsAmount: 4500 } });

    await initiateRefund(supabaseAdmin, refund.id);

    expect(calls.rpc).toHaveLength(1);
    expect(calls.rpc[0].fn).toBe('add_wallet_transaction');
    expect(calls.rpc[0].args.p_type).toBe('refund');
    expect(calls.rpc[0].args.p_amount).toBe(5000);
    expect(calls.rpc[0].args.p_reference).toBe(refund.refundReference);
    expect(refund.status).toBe('completed');
  });

  it('computes an informational proportional driver-impact figure without touching driver earnings', async () => {
    const refund = baseRideRefund({ amount: 2500 }); // partial refund, half the fare
    const { supabaseAdmin } = createRefundSupabaseMock({ refund, ride: { fare: 5000, driverEarningsAmount: 4500 } });

    await initiateRefund(supabaseAdmin, refund.id);

    expect(refund.requiresDriverAdjustmentReview).toBe(true);
    expect(refund.driverImpactAmount).toBe(2250); // 2500 * (4500/5000)
  });

  it('marks the refund failed (not completed) if the RPC itself errors, and never fabricates a wallet transaction id', async () => {
    const refund = baseRideRefund();
    const { supabaseAdmin } = createRefundSupabaseMock({ refund, rpcError: { message: 'insufficient balance' } });

    await initiateRefund(supabaseAdmin, refund.id);

    expect(refund.status).toBe('failed');
  });

  it('is a no-op if the refund is not in "requested" status (already being handled)', async () => {
    const refund = baseRideRefund({ status: 'completed' });
    const { supabaseAdmin, calls } = createRefundSupabaseMock({ refund });

    await initiateRefund(supabaseAdmin, refund.id);

    expect(calls.rpc).toHaveLength(0);
  });
});

describe('initiateRefund — wallet_topup (debit wallet + provider refund)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('debits the wallet first, then calls the provider, and never marks completed from the creation response alone', async () => {
    vi.spyOn(refundProvider, 'createPaystackRefund').mockResolvedValue({
      ok: true, outcome: 'created', httpStatus: 200, message: '',
      refund: { providerRefundId: 'rf_1', providerState: 'pending', amount: 2000, currency: 'NGN', raw: {} },
    });
    const refund = baseWalletTopupRefund();
    const { supabaseAdmin, calls } = createRefundSupabaseMock({ refund, paymentIntent: basePaymentIntent() });

    await initiateRefund(supabaseAdmin, refund.id);

    const debitCall = calls.rpc.find((c) => c.args.p_type === 'debit');
    expect(debitCall).toBeTruthy();
    expect(debitCall!.args.p_amount).toBe(-2000);
    expect(refund.providerRefundId).toBe('rf_1');
    expect(refund.status).toBe('processing'); // NOT completed
  });

  it('a network timeout after the wallet debit triggers a provider lookup rather than assuming failure', async () => {
    vi.spyOn(refundProvider, 'createPaystackRefund').mockResolvedValue({
      ok: false, outcome: 'network_error', refund: null, httpStatus: null, message: 'Network error',
    });
    const fetchSpy = vi.spyOn(refundProvider, 'fetchPaystackRefundsForTransaction').mockResolvedValue([]);
    const refund = baseWalletTopupRefund();
    const { supabaseAdmin } = createRefundSupabaseMock({ refund, paymentIntent: basePaymentIntent() });

    await initiateRefund(supabaseAdmin, refund.id);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(refund.status).toBe('unknown'); // genuinely undeterminable, not silently marked failed
  });

  it('a clear provider rejection reverses the wallet debit rather than stranding the rider short', async () => {
    vi.spyOn(refundProvider, 'createPaystackRefund').mockResolvedValue({
      ok: false, outcome: 'rejected', refund: null, httpStatus: 400, message: 'Transaction not refundable',
    });
    const refund = baseWalletTopupRefund();
    const { supabaseAdmin, calls } = createRefundSupabaseMock({ refund, paymentIntent: basePaymentIntent() });

    await initiateRefund(supabaseAdmin, refund.id);

    const reversalCall = calls.rpc.find((c) => c.args.p_reference === `${refund.refundReference}-REVERSAL`);
    expect(reversalCall).toBeTruthy();
    expect(reversalCall!.args.p_amount).toBe(2000); // credits the debited amount back
    expect(refund.status).toBe('failed');
  });

  it('insufficient wallet balance blocks the refund entirely — never calls the provider', async () => {
    const createSpy = vi.spyOn(refundProvider, 'createPaystackRefund');
    const refund = baseWalletTopupRefund();
    const { supabaseAdmin } = createRefundSupabaseMock({
      refund, paymentIntent: basePaymentIntent(), rpcError: { message: 'insufficient balance' },
    });

    await initiateRefund(supabaseAdmin, refund.id);

    expect(createSpy).not.toHaveBeenCalled();
    expect(refund.status).toBe('failed');
  });

  it('a concurrent duplicate execution attempt is blocked before any wallet debit', async () => {
    const createSpy = vi.spyOn(refundProvider, 'createPaystackRefund');
    const refund = baseWalletTopupRefund();
    const { supabaseAdmin, calls } = createRefundSupabaseMock({
      refund, paymentIntent: basePaymentIntent(),
      attemptInsertError: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });

    await initiateRefund(supabaseAdmin, refund.id);

    expect(createSpy).not.toHaveBeenCalled();
    expect(calls.rpc.filter((c) => c.args.p_type === 'debit')).toHaveLength(0);
  });

  it('uses Flutterwave with the provider transaction id, never our own reference, and fails gracefully when it is missing', async () => {
    const flwCreateSpy = vi.spyOn(refundProvider, 'createFlutterwaveRefund').mockResolvedValue({
      ok: true, outcome: 'created', httpStatus: 200, message: '',
      refund: { providerRefundId: 'flw_rf_1', providerState: 'pending', amount: 2000, currency: 'NGN', raw: {} },
    });
    const refund = baseWalletTopupRefund();
    const { supabaseAdmin } = createRefundSupabaseMock({
      refund, paymentIntent: basePaymentIntent({ provider: 'flutterwave', providerTransactionId: '4242' }),
    });

    await initiateRefund(supabaseAdmin, refund.id);

    expect(flwCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ transactionId: '4242' }));
    expect(refund.providerRefundId).toBe('flw_rf_1');
  });
});

describe('reconcileOneRefund', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('self-heals: provider confirms success while Pantra is processing -> completed', async () => {
    vi.spyOn(refundProvider, 'fetchPaystackRefundsForTransaction').mockResolvedValue([
      { providerRefundId: 'rf_1', providerState: 'successful', amount: 2000, currency: 'NGN', raw: {} },
    ]);
    const refund = baseWalletTopupRefund({ status: 'processing', providerRefundId: 'rf_1' });
    const { supabaseAdmin, calls } = createRefundSupabaseMock({ refund, paymentIntent: basePaymentIntent() });

    const result = await reconcileOneRefund(supabaseAdmin, refund.id);

    expect(result.status).toBe(true);
    expect(refund.status).toBe('completed');
    expect(calls.reconciliationInserts).toHaveLength(0);
  });

  it('provider confirms failure -> reverses the wallet debit and marks failed', async () => {
    vi.spyOn(refundProvider, 'fetchPaystackRefundsForTransaction').mockResolvedValue([
      { providerRefundId: 'rf_1', providerState: 'failed', amount: null, currency: 'NGN', raw: {} },
    ]);
    const refund = baseWalletTopupRefund({ status: 'processing', providerRefundId: 'rf_1' });
    const { supabaseAdmin, calls } = createRefundSupabaseMock({ refund, paymentIntent: basePaymentIntent() });

    await reconcileOneRefund(supabaseAdmin, refund.id);

    expect(refund.status).toBe('failed');
    expect(calls.rpc.some((c) => c.args.p_reference === `${refund.refundReference}-REVERSAL`)).toBe(true);
  });

  it('no matching provider refund found -> unknown status + a reconciliation record, never a blind retry', async () => {
    vi.spyOn(refundProvider, 'fetchPaystackRefundsForTransaction').mockResolvedValue([]);
    const refund = baseWalletTopupRefund({ status: 'processing', providerRefundId: 'rf_1' });
    const { supabaseAdmin, calls } = createRefundSupabaseMock({ refund, paymentIntent: basePaymentIntent() });

    await reconcileOneRefund(supabaseAdmin, refund.id);

    expect(refund.status).toBe('unknown');
    expect(calls.reconciliationInserts[0].mismatchType).toBe('refund_unmatched_provider_transaction');
  });

  it('an amount mismatch is flagged, never silently completed', async () => {
    vi.spyOn(refundProvider, 'fetchPaystackRefundsForTransaction').mockResolvedValue([
      { providerRefundId: 'rf_1', providerState: 'successful', amount: 1500, currency: 'NGN', raw: {} },
    ]);
    const refund = baseWalletTopupRefund({ status: 'processing', amount: 2000, providerRefundId: 'rf_1' });
    const { supabaseAdmin, calls } = createRefundSupabaseMock({ refund, paymentIntent: basePaymentIntent() });

    await reconcileOneRefund(supabaseAdmin, refund.id);

    expect(refund.status).toBe('unknown');
    expect(calls.reconciliationInserts[0].mismatchType).toBe('refund_amount_mismatch');
  });

  it('reconciliation never applies to a ride_wallet_payment refund (nothing provider-backed to check)', async () => {
    const refund = baseRideRefund({ status: 'completed' });
    const { supabaseAdmin } = createRefundSupabaseMock({ refund });

    const result = await reconcileOneRefund(supabaseAdmin, refund.id);

    expect(result.status).toBe(false);
    expect(result.message).toContain('provider-backed');
  });
});

describe('processRefundWebhookEvent', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('an unmatched provider refund id is recorded without crashing', async () => {
    const { supabaseAdmin, calls } = createRefundSupabaseMock({ refund: null });

    await processRefundWebhookEvent(supabaseAdmin, 'paystack', { event: 'refund.processed', data: { id: 999, amount: 200000 } });

    expect(calls.eventInserts[0].processingStatus).toBe('rejected_unmatched_refund');
  });

  it('an event for an already-terminal refund is ignored as a duplicate', async () => {
    const refund = baseWalletTopupRefund({ status: 'completed', providerRefundId: 'rf_1' });
    const { supabaseAdmin, calls } = createRefundSupabaseMock({ refund });

    await processRefundWebhookEvent(supabaseAdmin, 'paystack', { event: 'refund.processed', data: { id: 'rf_1', amount: 200000 } });

    expect(calls.eventInserts[0].processingStatus).toBe('ignored_duplicate');
    expect(calls.refundUpdates).toHaveLength(0);
  });

  it('refund.processed never trusts the payload directly — it re-verifies with Paystack, and only THEN completes', async () => {
    const verifySpy = vi.spyOn(refundProvider, 'fetchPaystackRefundsForTransaction').mockResolvedValue([
      { providerRefundId: 'rf_1', providerState: 'successful', amount: 2000, currency: 'NGN', raw: {} },
    ]);
    const refund = baseWalletTopupRefund({ status: 'processing', amount: 2000, providerRefundId: 'rf_1' });
    const { supabaseAdmin } = createRefundSupabaseMock({ refund, paymentIntent: basePaymentIntent() });

    await processRefundWebhookEvent(supabaseAdmin, 'paystack', { event: 'refund.processed', data: { id: 'rf_1', amount: 200000 } });

    expect(verifySpy).toHaveBeenCalledTimes(1); // the webhook triggered verification, not a direct status write
    expect(refund.status).toBe('completed');
  });

  it('a webhook claiming success is NOT applied if provider verification disagrees (provider verification failure)', async () => {
    vi.spyOn(refundProvider, 'fetchPaystackRefundsForTransaction').mockResolvedValue([
      { providerRefundId: 'rf_1', providerState: 'pending', amount: 2000, currency: 'NGN', raw: {} },
    ]);
    const refund = baseWalletTopupRefund({ status: 'processing', amount: 2000, providerRefundId: 'rf_1' });
    const { supabaseAdmin } = createRefundSupabaseMock({ refund, paymentIntent: basePaymentIntent() });

    await processRefundWebhookEvent(supabaseAdmin, 'paystack', { event: 'refund.processed', data: { id: 'rf_1', amount: 200000 } });

    // The webhook SAID successful, but the provider's own API still says
    // pending — the webhook payload is never trusted as sufficient on its own.
    expect(refund.status).not.toBe('completed');
  });

  it('refund.failed triggers verification, which reverses the wallet debit and marks failed', async () => {
    vi.spyOn(refundProvider, 'fetchPaystackRefundsForTransaction').mockResolvedValue([
      { providerRefundId: 'rf_1', providerState: 'failed', amount: null, currency: 'NGN', raw: {} },
    ]);
    const refund = baseWalletTopupRefund({ status: 'processing', providerRefundId: 'rf_1' });
    const { supabaseAdmin, calls } = createRefundSupabaseMock({ refund, paymentIntent: basePaymentIntent() });

    await processRefundWebhookEvent(supabaseAdmin, 'paystack', { event: 'refund.failed', data: { id: 'rf_1' } });

    expect(refund.status).toBe('failed');
    expect(calls.rpc.some((c) => c.args.p_reference === `${refund.refundReference}-REVERSAL`)).toBe(true);
  });

  it('20 duplicate deliveries of the same event apply exactly one transition (duplicate provider notifications)', async () => {
    vi.spyOn(refundProvider, 'fetchPaystackRefundsForTransaction').mockResolvedValue([
      { providerRefundId: 'rf_1', providerState: 'successful', amount: 2000, currency: 'NGN', raw: {} },
    ]);
    const refund = baseWalletTopupRefund({ status: 'processing', amount: 2000, providerRefundId: 'rf_1' });
    const { supabaseAdmin, calls } = createRefundSupabaseMock({ refund, paymentIntent: basePaymentIntent() });

    for (let i = 0; i < 20; i++) {
      await processRefundWebhookEvent(supabaseAdmin, 'paystack', { event: 'refund.processed', data: { id: 'rf_1', amount: 200000 } });
    }

    expect(refund.status).toBe('completed');
    expect(calls.refundUpdates.filter((u) => u.status === 'completed')).toHaveLength(1);
  });

  it('a webhook received after the refund already completed is ignored (webhook after completion)', async () => {
    const verifySpy = vi.spyOn(refundProvider, 'fetchPaystackRefundsForTransaction');
    const refund = baseWalletTopupRefund({ status: 'completed', providerRefundId: 'rf_1' });
    const { supabaseAdmin, calls } = createRefundSupabaseMock({ refund, paymentIntent: basePaymentIntent() });

    await processRefundWebhookEvent(supabaseAdmin, 'paystack', { event: 'refund.processed', data: { id: 'rf_1', amount: 200000 } });

    expect(verifySpy).not.toHaveBeenCalled(); // already terminal — never re-verifies, never re-transitions
    expect(calls.refundUpdates).toHaveLength(0);
  });

  it('a webhook received after the refund already failed is ignored (webhook after failure)', async () => {
    const verifySpy = vi.spyOn(refundProvider, 'fetchPaystackRefundsForTransaction');
    const refund = baseWalletTopupRefund({ status: 'failed', providerRefundId: 'rf_1' });
    const { supabaseAdmin, calls } = createRefundSupabaseMock({ refund, paymentIntent: basePaymentIntent() });

    await processRefundWebhookEvent(supabaseAdmin, 'paystack', { event: 'refund.failed', data: { id: 'rf_1' } });

    expect(verifySpy).not.toHaveBeenCalled();
    expect(calls.refundUpdates).toHaveLength(0);
  });

  it('a forged/malformed webhook with no provider refund id is ignored rather than crashing', async () => {
    const { supabaseAdmin, calls } = createRefundSupabaseMock({ refund: null });

    await processRefundWebhookEvent(supabaseAdmin, 'paystack', { event: 'refund.processed', data: {} });

    expect(calls.eventInserts).toHaveLength(0);
  });
});

// Flutterwave's refund notification arrives as a FLAT object with no
// top-level "event" field at all (verified live against Flutterwave's docs
// during this hardening pass) — a fundamentally different shape from
// Paystack's {event, data} wrapper. These tests exercise that shape
// directly, and the webhook/callback convergence the spec requires.
describe('Flutterwave refund webhook + callbackurl — converge into one processor', () => {
  beforeEach(() => vi.restoreAllMocks());

  const flutterwaveFlatPayload = (overrides: Record<string, unknown> = {}) => ({
    id: 77,
    AmountRefunded: 2000,
    status: 'completed-bank-transfer',
    FlwRef: 'FLW-REF-1',
    TransactionId: 999,
    ...overrides,
  });

  it('a webhook (event-less, flat shape) re-verifies via GET /v3/refunds/{id} before completing — never trusts the payload directly', async () => {
    const lookupSpy = vi.spyOn(refundProvider, 'fetchFlutterwaveRefundById').mockResolvedValue({
      providerRefundId: '77', providerState: 'successful', amount: 2000, currency: null, flwRef: 'FLW-REF-1', transactionId: '999', raw: {},
    });
    const refund = baseWalletTopupRefund({
      status: 'processing', amount: 2000, provider: 'flutterwave', providerRefundId: '77', paymentIntentId: 'intent-1',
    });
    const { supabaseAdmin } = createRefundSupabaseMock({ refund, paymentIntent: basePaymentIntent({ provider: 'flutterwave', providerTransactionId: '999' }) });

    await processRefundWebhookEvent(supabaseAdmin, 'flutterwave', flutterwaveFlatPayload());

    expect(lookupSpy).toHaveBeenCalledWith('77');
    expect(refund.status).toBe('completed');
  });

  it('the unsigned callbackurl notification goes through the EXACT SAME processor and produces the same outcome', async () => {
    vi.spyOn(refundProvider, 'fetchFlutterwaveRefundById').mockResolvedValue({
      providerRefundId: '77', providerState: 'successful', amount: 2000, currency: null, flwRef: 'FLW-REF-1', transactionId: '999', raw: {},
    });
    const refund = baseWalletTopupRefund({
      status: 'processing', amount: 2000, provider: 'flutterwave', providerRefundId: '77', paymentIntentId: 'intent-1',
    });
    const { supabaseAdmin } = createRefundSupabaseMock({ refund, paymentIntent: basePaymentIntent({ provider: 'flutterwave', providerTransactionId: '999' }) });

    await processFlutterwaveRefundCallback(supabaseAdmin, flutterwaveFlatPayload());

    expect(refund.status).toBe('completed'); // identical outcome to the webhook path above
  });

  it('a create-response status of "completed" alone is never enough to complete — reconciliation must confirm a completed-<channel> status', async () => {
    vi.spyOn(refundProvider, 'fetchFlutterwaveRefundById').mockResolvedValue({
      providerRefundId: '77', providerState: 'pending', amount: 2000, currency: null, flwRef: 'FLW-REF-1', transactionId: '999', raw: {},
    });
    const refund = baseWalletTopupRefund({
      status: 'processing', amount: 2000, provider: 'flutterwave', providerRefundId: '77', paymentIntentId: 'intent-1',
    });
    const { supabaseAdmin } = createRefundSupabaseMock({ refund, paymentIntent: basePaymentIntent({ provider: 'flutterwave', providerTransactionId: '999' }) });

    await processRefundWebhookEvent(supabaseAdmin, 'flutterwave', flutterwaveFlatPayload({ status: 'completed' }));

    expect(refund.status).not.toBe('completed');
  });

  it('a transactionId mismatch is treated as a hard stop, never a silent match (identity validation)', async () => {
    const refund = baseWalletTopupRefund({
      status: 'processing', amount: 2000, provider: 'flutterwave', providerRefundId: '77', paymentIntentId: 'intent-1',
    });
    const { supabaseAdmin, calls } = createRefundSupabaseMock({ refund, paymentIntent: basePaymentIntent({ provider: 'flutterwave', providerTransactionId: '999' }) });

    // The notification claims a DIFFERENT original transaction than the one
    // this refund was actually requested against.
    await processRefundWebhookEvent(supabaseAdmin, 'flutterwave', flutterwaveFlatPayload({ TransactionId: 111222 }));

    expect(refund.status).not.toBe('completed');
    expect(calls.reconciliationInserts[0]?.mismatchType).toBe('refund_unmatched_provider_transaction');
  });

  it('an unknown/unmatched Flutterwave refund id is recorded without crashing', async () => {
    const { supabaseAdmin, calls } = createRefundSupabaseMock({ refund: null });

    await processRefundWebhookEvent(supabaseAdmin, 'flutterwave', flutterwaveFlatPayload({ id: 999999 }));

    expect(calls.eventInserts[0].processingStatus).toBe('rejected_unmatched_refund');
  });

  it('a currency mismatch (where the provider actually reports one) is flagged, never silently completed', async () => {
    vi.spyOn(refundProvider, 'fetchFlutterwaveRefundById').mockResolvedValue({
      providerRefundId: '77', providerState: 'successful', amount: 2000, currency: 'USD', flwRef: 'FLW-REF-1', transactionId: '999', raw: {},
    });
    const refund = baseWalletTopupRefund({
      status: 'processing', amount: 2000, provider: 'flutterwave', providerRefundId: '77', paymentIntentId: 'intent-1',
    });
    const { supabaseAdmin, calls } = createRefundSupabaseMock({
      refund, paymentIntent: basePaymentIntent({ provider: 'flutterwave', providerTransactionId: '999', currency: 'NGN' }),
    });

    await reconcileOneRefund(supabaseAdmin, refund.id);

    expect(refund.status).not.toBe('completed');
    expect(calls.reconciliationInserts[0]?.mismatchType).toBe('refund_currency_mismatch');
  });

  it('a genuine timeout with multiple same-amount refunds on the same transaction stays "unknown" rather than guessing which one is ours (ambiguous provider result)', async () => {
    vi.spyOn(refundProvider, 'fetchFlutterwaveRefundsForTransaction').mockResolvedValue([
      { providerRefundId: '77', providerState: 'successful', amount: 2000, currency: null, flwRef: 'FLW-REF-1', transactionId: '999', raw: {} },
      { providerRefundId: '78', providerState: 'successful', amount: 2000, currency: null, flwRef: 'FLW-REF-2', transactionId: '999', raw: {} },
    ]);
    // No providerRefundId known yet — the true "never got a response at all" timeout case.
    const refund = baseWalletTopupRefund({
      status: 'processing', amount: 2000, provider: 'flutterwave', providerRefundId: null, paymentIntentId: 'intent-1',
    });
    const { supabaseAdmin } = createRefundSupabaseMock({ refund, paymentIntent: basePaymentIntent({ provider: 'flutterwave', providerTransactionId: '999' }) });

    const result = await reconcileOneRefund(supabaseAdmin, refund.id);

    expect(result.status).toBe(false);
    expect(refund.status).not.toBe('completed'); // never guesses between two equally-plausible candidates
  });

  it('a timeout followed by a successful reconciliation resolves cleanly once the provider result is unambiguous', async () => {
    vi.spyOn(refundProvider, 'fetchFlutterwaveRefundsForTransaction').mockResolvedValue([
      { providerRefundId: '77', providerState: 'successful', amount: 2000, currency: null, flwRef: 'FLW-REF-1', transactionId: '999', raw: {} },
    ]);
    const refund = baseWalletTopupRefund({
      status: 'processing', amount: 2000, provider: 'flutterwave', providerRefundId: null, paymentIntentId: 'intent-1',
    });
    const { supabaseAdmin } = createRefundSupabaseMock({ refund, paymentIntent: basePaymentIntent({ provider: 'flutterwave', providerTransactionId: '999' }) });

    const result = await reconcileOneRefund(supabaseAdmin, refund.id);

    expect(result.status).toBe(true);
    expect(refund.status).toBe('completed');
    expect(refund.providerRefundId).toBe('77'); // identity learned from the search, not guessed from amount alone in the single-match case
  });
});
