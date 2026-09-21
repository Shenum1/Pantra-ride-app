import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('refund-provider', () => {
  const originalFetch = global.fetch;
  const originalPaystackKey = process.env.PAYSTACK_SECRET_KEY;
  const originalFlutterwaveKey = process.env.FLUTTERWAVE_SECRET_KEY;

  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_refund_provider_tests';
    process.env.FLUTTERWAVE_SECRET_KEY = 'FLWSECK_TEST-refund-provider-tests';
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.PAYSTACK_SECRET_KEY = originalPaystackKey;
    process.env.FLUTTERWAVE_SECRET_KEY = originalFlutterwaveKey;
  });

  it('createPaystackRefund converts naira to kobo and omits amount entirely for a full refund', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, message: 'ok', data: { id: 555, status: 'pending', amount: 200000, currency: 'NGN' } }),
    }) as any;
    const { createPaystackRefund } = await import('@/backend/lib/refund-provider');

    const partial = await createPaystackRefund({ transactionReference: 'PANTRA-abc', amount: 2000 });
    expect(partial.ok).toBe(true);
    expect(partial.refund?.providerRefundId).toBe('555');
    expect(partial.refund?.providerState).toBe('pending');
    let [, requestInit] = (global.fetch as any).mock.calls[0];
    expect(JSON.parse(requestInit.body)).toMatchObject({ transaction: 'PANTRA-abc', amount: 200000 });

    (global.fetch as any).mockClear();
    await createPaystackRefund({ transactionReference: 'PANTRA-abc' });
    [, requestInit] = (global.fetch as any).mock.calls[0];
    expect(JSON.parse(requestInit.body)).not.toHaveProperty('amount');
  });

  it('createPaystackRefund reports outcome "network_error" on a fetch exception, never a confirmed failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('fetch failed')) as any;
    const { createPaystackRefund } = await import('@/backend/lib/refund-provider');

    const result = await createPaystackRefund({ transactionReference: 'PANTRA-abc', amount: 2000 });

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('network_error');
  });

  it('fetchPaystackRefundsForTransaction maps status "processed" to "successful" and converts kobo to naira', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, data: [{ id: 555, status: 'processed', amount: 200000, currency: 'NGN' }] }),
    }) as any;
    const { fetchPaystackRefundsForTransaction } = await import('@/backend/lib/refund-provider');

    const results = await fetchPaystackRefundsForTransaction('PANTRA-abc');

    expect(results).toHaveLength(1);
    expect(results[0].providerState).toBe('successful');
    expect(results[0].amount).toBe(2000);
  });

  it('fetchPaystackRefundsForTransaction returns an empty array (never throws) when the provider call fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('down')) as any;
    const { fetchPaystackRefundsForTransaction } = await import('@/backend/lib/refund-provider');

    const results = await fetchPaystackRefundsForTransaction('PANTRA-abc');

    expect(results).toEqual([]);
  });

  it('createFlutterwaveRefund calls the transaction-id-scoped endpoint (never our own reference), and passes callbackurl when provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      // 'completed' on the CREATE response means "initiated, pending
      // disbursement" per Flutterwave's own docs — NOT success yet.
      json: async () => ({ status: 'success', message: 'ok', data: { id: 77, status: 'completed', amount_refunded: 2000, currency: 'NGN', flw_ref: 'FLW-REF-1', tx_id: 4242 } }),
    }) as any;
    const { createFlutterwaveRefund } = await import('@/backend/lib/refund-provider');

    const result = await createFlutterwaveRefund({ transactionId: '4242', amount: 2000, callbackUrl: 'https://api.pantra.app/api/webhooks/flutterwave-refund-callback' });

    expect(result.ok).toBe(true);
    expect(result.refund?.providerRefundId).toBe('77');
    expect(result.refund?.providerState).toBe('pending'); // NOT 'successful' — creation accepted, not yet disbursed
    expect(result.refund?.flwRef).toBe('FLW-REF-1');
    expect(result.refund?.transactionId).toBe('4242');
    const [url, requestInit] = (global.fetch as any).mock.calls[0];
    expect(url).toContain('/transactions/4242/refund');
    expect(JSON.parse(requestInit.body).callbackurl).toBe('https://api.pantra.app/api/webhooks/flutterwave-refund-callback');
  });

  it('mapFlutterwaveRefundStatus: only the completed-<channel> suffixed statuses count as successful', async () => {
    const { createFlutterwaveRefund } = await import('@/backend/lib/refund-provider');
    const statuses: [string, 'successful' | 'pending' | 'unknown'][] = [
      ['completed', 'pending'],
      ['processing', 'pending'],
      ['pending-momo', 'pending'],
      ['completed-bank-transfer', 'successful'],
      ['completed-momo', 'successful'],
      ['completed-mpgs', 'successful'],
      ['completed-offline', 'successful'],
      ['completed-preauth', 'successful'],
      ['something-unrecognized', 'unknown'],
    ];
    for (const [status, expected] of statuses) {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success', data: { id: 1, status, amount_refunded: 100 } }),
      }) as any;
      const result = await createFlutterwaveRefund({ transactionId: '1', amount: 100 });
      expect(result.refund?.providerState, `status=${status}`).toBe(expected);
    }
  });

  it('a meta.disburse_status of "failed" is treated as a genuine failure even when the top-level status still reads "completed"', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success', data: { id: 1, status: 'completed', amount_refunded: 100, meta: JSON.stringify({ disburse_status: 'failed' }) } }),
    }) as any;
    const { createFlutterwaveRefund } = await import('@/backend/lib/refund-provider');

    const result = await createFlutterwaveRefund({ transactionId: '1', amount: 100 });

    expect(result.refund?.providerState).toBe('failed');
  });

  it('fetchFlutterwaveRefundById queries GET /v3/refunds/{id} (identity lookup, not a transaction search)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success', data: { id: 77, status: 'completed-bank-transfer', amount_refunded: 2000, flw_ref: 'FLW-REF-1' } }),
    }) as any;
    const { fetchFlutterwaveRefundById } = await import('@/backend/lib/refund-provider');

    const result = await fetchFlutterwaveRefundById('77');

    expect(result?.providerState).toBe('successful');
    const [url] = (global.fetch as any).mock.calls[0];
    expect(url).toContain('/v3/refunds/77');
  });

  it('fetchFlutterwaveRefundsForTransaction queries GET /v3/refunds?id=<transactionId>', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success', data: [{ id: 77, status: 'processing', amount_refunded: 2000, flw_ref: 'FLW-REF-1', transaction_id: 4242 }] }),
    }) as any;
    const { fetchFlutterwaveRefundsForTransaction } = await import('@/backend/lib/refund-provider');

    const results = await fetchFlutterwaveRefundsForTransaction('4242');

    expect(results).toHaveLength(1);
    expect(results[0].transactionId).toBe('4242');
    const [url] = (global.fetch as any).mock.calls[0];
    expect(url).toContain('/v3/refunds?id=4242');
  });

  it('isFlutterwaveRefundWebhookShape recognizes the flat, unwrapped refund payload Flutterwave actually sends', async () => {
    const { isFlutterwaveRefundWebhookShape } = await import('@/backend/lib/refund-provider');

    // Verified-live example shape: no "event" wrapper, PascalCase-ish fields.
    expect(isFlutterwaveRefundWebhookShape({
      id: 99025, AmountRefunded: 100, status: 'completed', FlwRef: '4687213286', TransactionId: 9231836,
    })).toBe(true);

    // A charge/transfer webhook (event-wrapped, no flw_ref) must not match.
    expect(isFlutterwaveRefundWebhookShape({ event: 'charge.completed', data: { id: 1, tx_ref: 'PANTRA-x' } })).toBe(false);
    expect(isFlutterwaveRefundWebhookShape(null)).toBe(false);
  });

  it('generateRefundReference produces a distinct, prefixed reference every call', async () => {
    const { generateRefundReference } = await import('@/backend/lib/refund-provider');
    const a = generateRefundReference();
    const b = generateRefundReference();
    expect(a).toMatch(/^PANTRA-REFUND-/);
    expect(a).not.toBe(b);
  });
});
