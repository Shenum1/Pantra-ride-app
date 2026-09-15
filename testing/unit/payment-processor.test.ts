import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as paymentProviders from '@/backend/lib/payment-providers';
import { processVerifiedPayment } from '@/backend/lib/payment-processor';

interface MockIntent {
  id: string;
  userId: string;
  provider: 'paystack' | 'flutterwave';
  reference: string;
  expectedAmount: number;
  currency: string;
  status: string;
  paymentMethodId: string | null;
}

function createSupabaseMock(opts: {
  intent: MockIntent | null;
  rpcError?: { message: string } | null;
  eventsInsertError?: { code: string; message: string } | null;
}) {
  const calls = {
    intentUpdates: [] as { table: string; row: any }[],
    eventsInserts: [] as any[],
    reconciliationInserts: [] as any[],
    rpc: [] as { fn: string; args: any }[],
  };

  const supabaseAdmin: any = {
    from(table: string) {
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        lt: () => builder,
        limit: () => builder,
        maybeSingle: () => {
          if (table === 'payment_intents') {
            return Promise.resolve({ data: opts.intent, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        insert: (row: any) => {
          if (table === 'payment_events') {
            calls.eventsInserts.push(row);
            if (opts.eventsInsertError) return Promise.resolve({ error: opts.eventsInsertError });
            return Promise.resolve({ error: null });
          }
          if (table === 'payment_reconciliation_records') {
            calls.reconciliationInserts.push(row);
            return Promise.resolve({ error: null });
          }
          return Promise.resolve({ error: null });
        },
        update: (row: any) => {
          calls.intentUpdates.push({ table, row });
          if (opts.intent) opts.intent.status = row.status; // mutate mock state, mirrors a real DB row
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

function baseIntent(overrides: Partial<MockIntent> = {}): MockIntent {
  return {
    id: 'intent-1',
    userId: 'user-1',
    provider: 'paystack',
    reference: 'PANTRA-ref-1',
    expectedAmount: 5000,
    currency: 'NGN',
    status: 'pending',
    paymentMethodId: null,
    ...overrides,
  };
}

describe('processVerifiedPayment', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('credits the wallet exactly once when the provider confirms a matching amount/currency', async () => {
    vi.spyOn(paymentProviders, 'verifyPaystackTransaction').mockResolvedValue({
      success: true, providerState: 'successful', amount: 5000, currency: 'NGN', message: '', raw: { data: { status: 'success' } },
    });
    const intent = baseIntent();
    const { supabaseAdmin, calls } = createSupabaseMock({ intent });

    const result = await processVerifiedPayment({
      supabaseAdmin, provider: 'paystack', reference: intent.reference, sourceChannel: 'webhook', eventType: 'charge.success',
    });

    expect(result.status).toBe(true);
    expect(calls.rpc).toHaveLength(1);
    expect(calls.rpc[0].fn).toBe('add_wallet_transaction');
    expect(calls.rpc[0].args.p_reference).toBe(intent.reference);
    expect(calls.rpc[0].args.p_type).toBe('add_money');
    expect(calls.intentUpdates.some((u) => u.row.status === 'successful')).toBe(true);
    expect(calls.reconciliationInserts).toHaveLength(0);
  });

  it('marks the intent "failed" (terminal) only on a provider-CONFIRMED failure, and never re-credits on retry', async () => {
    vi.spyOn(paymentProviders, 'verifyPaystackTransaction').mockResolvedValue({
      success: false, providerState: 'failed', amount: null, currency: null, message: 'Declined', raw: { data: { status: 'failed' } },
    });
    const intent = baseIntent();
    const { supabaseAdmin, calls } = createSupabaseMock({ intent });

    const first = await processVerifiedPayment({
      supabaseAdmin, provider: 'paystack', reference: intent.reference, sourceChannel: 'webhook', eventType: 'charge.failed',
    });
    expect(first.status).toBe(false);
    expect(intent.status).toBe('failed');
    expect(calls.rpc).toHaveLength(0);

    // Retry (e.g. a duplicate webhook delivery) against the now-terminal intent.
    const second = await processVerifiedPayment({
      supabaseAdmin, provider: 'paystack', reference: intent.reference, sourceChannel: 'webhook', eventType: 'charge.failed',
    });
    expect(second.status).toBe(false);
    expect(calls.rpc).toHaveLength(0);
  });

  it('a transient/undeterminable provider response marks the intent "unknown", NEVER "failed", and remains retryable', async () => {
    vi.spyOn(paymentProviders, 'verifyPaystackTransaction')
      .mockResolvedValueOnce({ success: false, providerState: 'unknown', amount: null, currency: null, message: 'Network error', raw: null })
      .mockResolvedValueOnce({ success: true, providerState: 'successful', amount: 5000, currency: 'NGN', message: '', raw: { data: { status: 'success' } } });
    const intent = baseIntent();
    const { supabaseAdmin, calls } = createSupabaseMock({ intent });

    const first = await processVerifiedPayment({
      supabaseAdmin, provider: 'paystack', reference: intent.reference, sourceChannel: 'client_verification', callingUserId: 'user-1', eventType: 'client_verify',
    });
    expect(first.status).toBe(false);
    expect(intent.status).toBe('unknown');
    expect(intent.status).not.toBe('failed');

    // Because 'unknown' is not terminal, a later retry re-verifies and can still succeed.
    const second = await processVerifiedPayment({
      supabaseAdmin, provider: 'paystack', reference: intent.reference, sourceChannel: 'client_verification', callingUserId: 'user-1', eventType: 'client_verify',
    });
    expect(second.status).toBe(true);
    expect(calls.rpc).toHaveLength(1);
  });

  it('rejects and records a reconciliation entry on an amount mismatch, without crediting', async () => {
    vi.spyOn(paymentProviders, 'verifyPaystackTransaction').mockResolvedValue({
      success: true, providerState: 'successful', amount: 50000, currency: 'NGN', message: '', raw: { data: { status: 'success' } },
    });
    const intent = baseIntent({ expectedAmount: 5000 });
    const { supabaseAdmin, calls } = createSupabaseMock({ intent });

    const result = await processVerifiedPayment({
      supabaseAdmin, provider: 'paystack', reference: intent.reference, sourceChannel: 'webhook', eventType: 'charge.success',
    });

    expect(result.status).toBe(false);
    expect(calls.rpc).toHaveLength(0);
    expect(calls.reconciliationInserts).toHaveLength(1);
    expect(calls.reconciliationInserts[0].mismatchType).toBe('amount_mismatch');
    expect(intent.status).toBe('unknown');
  });

  it('rejects and records a reconciliation entry on a currency mismatch, without crediting', async () => {
    vi.spyOn(paymentProviders, 'verifyPaystackTransaction').mockResolvedValue({
      success: true, providerState: 'successful', amount: 5000, currency: 'USD', message: '', raw: { data: { status: 'success' } },
    });
    const intent = baseIntent({ currency: 'NGN' });
    const { supabaseAdmin, calls } = createSupabaseMock({ intent });

    const result = await processVerifiedPayment({
      supabaseAdmin, provider: 'paystack', reference: intent.reference, sourceChannel: 'webhook', eventType: 'charge.success',
    });

    expect(result.status).toBe(false);
    expect(calls.rpc).toHaveLength(0);
    expect(calls.reconciliationInserts[0].mismatchType).toBe('currency_mismatch');
  });

  it('rejects an unmatched provider reference (no payment_intents row) and records it for review', async () => {
    const { supabaseAdmin, calls } = createSupabaseMock({ intent: null });

    const result = await processVerifiedPayment({
      supabaseAdmin, provider: 'paystack', reference: 'PANTRA-does-not-exist', sourceChannel: 'webhook', eventType: 'charge.success',
    });

    expect(result.status).toBe(false);
    expect(calls.rpc).toHaveLength(0);
    expect(calls.reconciliationInserts[0].mismatchType).toBe('unmatched_provider_transaction');
  });

  it('a duplicate providerEventId never results in a second RPC call', async () => {
    vi.spyOn(paymentProviders, 'verifyPaystackTransaction').mockResolvedValue({
      success: true, providerState: 'successful', amount: 5000, currency: 'NGN', message: '', raw: { data: { status: 'success' } },
    });
    const intent = baseIntent();
    const { supabaseAdmin, calls } = createSupabaseMock({
      intent,
      eventsInsertError: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });

    await processVerifiedPayment({
      supabaseAdmin, provider: 'paystack', reference: intent.reference, sourceChannel: 'webhook', providerEventId: 'evt-1', eventType: 'charge.success',
    });
    // Same event redelivered — intent is now 'successful' (terminal), so this
    // short-circuits before ever calling verify or the RPC again.
    await processVerifiedPayment({
      supabaseAdmin, provider: 'paystack', reference: intent.reference, sourceChannel: 'webhook', providerEventId: 'evt-1', eventType: 'charge.success',
    });

    expect(calls.rpc).toHaveLength(1);
  });

  it('honors a late provider success on a Pantra-cancelled intent instead of discarding it', async () => {
    vi.spyOn(paymentProviders, 'verifyPaystackTransaction').mockResolvedValue({
      success: true, providerState: 'successful', amount: 5000, currency: 'NGN', message: '', raw: { data: { status: 'success' } },
    });
    const intent = baseIntent({ status: 'cancelled' });
    const { supabaseAdmin, calls } = createSupabaseMock({ intent });

    const result = await processVerifiedPayment({
      supabaseAdmin, provider: 'paystack', reference: intent.reference, sourceChannel: 'admin_reconciliation', eventType: 'reconciliation_sweep',
    });

    expect(result.status).toBe(true);
    expect(calls.rpc).toHaveLength(1);
    expect(intent.status).toBe('successful');
  });

  it('rejects client_verification when the caller does not own the payment intent', async () => {
    const intent = baseIntent({ userId: 'user-1' });
    const { supabaseAdmin, calls } = createSupabaseMock({ intent });

    const result = await processVerifiedPayment({
      supabaseAdmin, provider: 'paystack', reference: intent.reference, sourceChannel: 'client_verification',
      callingUserId: 'attacker-user-2', eventType: 'client_verify',
    });

    expect(result.status).toBe(false);
    expect(calls.rpc).toHaveLength(0);
  });

  it('forceRecheck on an already-successful intent detects a provider contradiction without mutating the intent', async () => {
    vi.spyOn(paymentProviders, 'verifyPaystackTransaction').mockResolvedValue({
      success: false, providerState: 'failed', amount: null, currency: null, message: 'now reported failed', raw: null,
    });
    const intent = baseIntent({ status: 'successful' });
    const { supabaseAdmin, calls } = createSupabaseMock({ intent });

    const result = await processVerifiedPayment({
      supabaseAdmin, provider: 'paystack', reference: intent.reference, sourceChannel: 'admin_reconciliation',
      eventType: 'reconciliation_spot_check', forceRecheck: true,
    });

    expect(result.status).toBe(false);
    expect(calls.rpc).toHaveLength(0);
    expect(calls.intentUpdates).toHaveLength(0); // never attempts to mutate the immutable 'successful' status
    expect(calls.reconciliationInserts[0].mismatchType).toBe('pantra_success_provider_failed');
    expect(intent.status).toBe('successful'); // unchanged
  });
});
