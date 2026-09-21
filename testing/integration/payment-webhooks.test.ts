import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';

// A dummy non-null client is enough here — processVerifiedPayment itself is
// mocked below, so nothing ever actually calls into Supabase. The webhook
// routes only check "is this null" before proceeding.
vi.mock('@/backend/lib/supabase-admin', () => ({
  supabaseAdmin: {},
}));

const processVerifiedPaymentMock = vi.fn();
vi.mock('@/backend/lib/payment-processor', () => ({
  processVerifiedPayment: (...args: unknown[]) => processVerifiedPaymentMock(...args),
}));

const processPayoutWebhookEventMock = vi.fn();
vi.mock('@/backend/lib/payout-processor', () => ({
  processPayoutWebhookEvent: (...args: unknown[]) => processPayoutWebhookEventMock(...args),
}));

const processRefundWebhookEventMock = vi.fn();
const processFlutterwaveRefundCallbackMock = vi.fn();
vi.mock('@/backend/lib/refund-processor', async () => {
  // isFlutterwaveRefundWebhookShape is real shape-detection logic (not a
  // network/DB call) — imported from the real, unmocked refund-provider
  // module so the dispatch tests below exercise actual behavior, not a
  // hand-rolled stand-in that could silently drift from the real function.
  const actualProvider = await vi.importActual<typeof import('@/backend/lib/refund-provider')>('@/backend/lib/refund-provider');
  return {
    processRefundWebhookEvent: (...args: unknown[]) => processRefundWebhookEventMock(...args),
    processFlutterwaveRefundCallback: (...args: unknown[]) => processFlutterwaveRefundCallbackMock(...args),
    isFlutterwaveRefundWebhookShape: actualProvider.isFlutterwaveRefundWebhookShape,
  };
});

process.env.PAYSTACK_SECRET_KEY = 'sk_test_shared_secret_for_webhook_tests';
process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH = 'flw-configured-hash-for-webhook-tests';

const { default: app } = await import('@/backend/hono');

describe('POST /webhooks/paystack', () => {
  beforeEach(() => {
    processVerifiedPaymentMock.mockReset();
    processVerifiedPaymentMock.mockResolvedValue({ status: true, message: 'ok' });
    processPayoutWebhookEventMock.mockReset();
    processPayoutWebhookEventMock.mockResolvedValue(undefined);
    processRefundWebhookEventMock.mockReset();
    processRefundWebhookEventMock.mockResolvedValue(undefined);
  });

  it('dispatches a refund.* event to the refund processor, never the payment or payout processor', async () => {
    const body = JSON.stringify({ event: 'refund.processed', data: { id: 555, amount: 200000 } });
    const signature = createHmac('sha512', 'sk_test_shared_secret_for_webhook_tests').update(body, 'utf8').digest('hex');

    const res = await app.request('/webhooks/paystack', {
      method: 'POST',
      headers: { 'x-paystack-signature': signature },
      body,
    });

    expect(res.status).toBe(200);
    expect(processRefundWebhookEventMock).toHaveBeenCalledTimes(1);
    expect(processRefundWebhookEventMock.mock.calls[0][1]).toBe('paystack');
    expect(processVerifiedPaymentMock).not.toHaveBeenCalled();
    expect(processPayoutWebhookEventMock).not.toHaveBeenCalled();
  });

  it('dispatches a transfer.* event to the payout processor, never the payment processor', async () => {
    const body = JSON.stringify({ event: 'transfer.success', data: { reference: 'PANTRA-PAYOUT-abc', id: 42, amount: 500000 } });
    const signature = createHmac('sha512', 'sk_test_shared_secret_for_webhook_tests').update(body, 'utf8').digest('hex');

    const res = await app.request('/webhooks/paystack', {
      method: 'POST',
      headers: { 'x-paystack-signature': signature },
      body,
    });

    expect(res.status).toBe(200);
    expect(processPayoutWebhookEventMock).toHaveBeenCalledTimes(1);
    expect(processVerifiedPaymentMock).not.toHaveBeenCalled();
  });

  it('still dispatches a charge.* event to the payment processor, never the payout processor', async () => {
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'PANTRA-charge-abc', id: 7 } });
    const signature = createHmac('sha512', 'sk_test_shared_secret_for_webhook_tests').update(body, 'utf8').digest('hex');

    const res = await app.request('/webhooks/paystack', {
      method: 'POST',
      headers: { 'x-paystack-signature': signature },
      body,
    });

    expect(res.status).toBe(200);
    expect(processVerifiedPaymentMock).toHaveBeenCalledTimes(1);
    expect(processPayoutWebhookEventMock).not.toHaveBeenCalled();
  });

  it('rejects a forged signature with 401 and never invokes the processor', async () => {
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'PANTRA-x', id: 123 } });
    const res = await app.request('/webhooks/paystack', {
      method: 'POST',
      headers: { 'x-paystack-signature': 'forged-signature' },
      body,
    });
    expect(res.status).toBe(401);
    expect(processVerifiedPaymentMock).not.toHaveBeenCalled();
  });

  it('rejects a missing signature header with 401', async () => {
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'PANTRA-x' } });
    const res = await app.request('/webhooks/paystack', { method: 'POST', body });
    expect(res.status).toBe(401);
    expect(processVerifiedPaymentMock).not.toHaveBeenCalled();
  });

  it('accepts a validly-signed payload, invokes the processor once, and acknowledges with 200', async () => {
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'PANTRA-abc-123', id: 987 } });
    const signature = createHmac('sha512', 'sk_test_shared_secret_for_webhook_tests').update(body, 'utf8').digest('hex');

    const res = await app.request('/webhooks/paystack', {
      method: 'POST',
      headers: { 'x-paystack-signature': signature, 'content-type': 'application/json' },
      body,
    });

    expect(res.status).toBe(200);
    expect(processVerifiedPaymentMock).toHaveBeenCalledTimes(1);
    expect(processVerifiedPaymentMock.mock.calls[0][0]).toMatchObject({
      provider: 'paystack',
      reference: 'PANTRA-abc-123',
      sourceChannel: 'webhook',
      providerEventId: '987',
      eventType: 'charge.success',
    });
  });

  it('an amount-mismatch outcome from the processor still acknowledges with 200 (the rejection itself was durably recorded)', async () => {
    processVerifiedPaymentMock.mockResolvedValue({ status: false, message: 'Amount mismatch detected.' });
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'PANTRA-mismatch', id: 1 } });
    const signature = createHmac('sha512', 'sk_test_shared_secret_for_webhook_tests').update(body, 'utf8').digest('hex');

    const res = await app.request('/webhooks/paystack', {
      method: 'POST',
      headers: { 'x-paystack-signature': signature },
      body,
    });

    expect(res.status).toBe(200);
  });

  it('an infrastructure failure inside processing surfaces as a 5xx, not a 200 — the provider must retry', async () => {
    processVerifiedPaymentMock.mockRejectedValue(new Error('Supabase temporarily unavailable'));
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'PANTRA-dbdown', id: 2 } });
    const signature = createHmac('sha512', 'sk_test_shared_secret_for_webhook_tests').update(body, 'utf8').digest('hex');

    const res = await app.request('/webhooks/paystack', {
      method: 'POST',
      headers: { 'x-paystack-signature': signature },
      body,
    });

    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  it('rejects a payload missing a reference before ever calling the processor', async () => {
    const body = JSON.stringify({ event: 'charge.success', data: {} });
    const signature = createHmac('sha512', 'sk_test_shared_secret_for_webhook_tests').update(body, 'utf8').digest('hex');
    const res = await app.request('/webhooks/paystack', {
      method: 'POST',
      headers: { 'x-paystack-signature': signature },
      body,
    });
    expect(res.status).toBe(400);
    expect(processVerifiedPaymentMock).not.toHaveBeenCalled();
  });
});

describe('POST /webhooks/flutterwave', () => {
  beforeEach(() => {
    processVerifiedPaymentMock.mockReset();
    processVerifiedPaymentMock.mockResolvedValue({ status: true, message: 'ok' });
    processRefundWebhookEventMock.mockReset();
    processRefundWebhookEventMock.mockResolvedValue(undefined);
  });

  it('dispatches an explicit event === "refund.completed" payload to the refund processor (defensive fallback shape)', async () => {
    const body = JSON.stringify({ event: 'refund.completed', data: { id: 77, status: 'completed', amount_refunded: 2000, flw_ref: 'FLW-REF-1' } });
    const res = await app.request('/webhooks/flutterwave', {
      method: 'POST',
      headers: { 'verif-hash': 'flw-configured-hash-for-webhook-tests' },
      body,
    });

    expect(res.status).toBe(200);
    expect(processRefundWebhookEventMock).toHaveBeenCalledTimes(1);
    expect(processRefundWebhookEventMock.mock.calls[0][1]).toBe('flutterwave');
    expect(processVerifiedPaymentMock).not.toHaveBeenCalled();
  });

  it('dispatches the REAL flat payload shape Flutterwave actually sends (no "event" field at all) via shape detection', async () => {
    // Verified live against Flutterwave's own docs — the refund webhook
    // body has no top-level "event" field, unlike charge.completed.
    const body = JSON.stringify({ id: 77, AmountRefunded: 2000, status: 'completed-bank-transfer', FlwRef: 'FLW-REF-1', TransactionId: 999 });
    const res = await app.request('/webhooks/flutterwave', {
      method: 'POST',
      headers: { 'verif-hash': 'flw-configured-hash-for-webhook-tests' },
      body,
    });

    expect(res.status).toBe(200);
    expect(processRefundWebhookEventMock).toHaveBeenCalledTimes(1);
    expect(processRefundWebhookEventMock.mock.calls[0][1]).toBe('flutterwave');
  });

  it('rejects a forged verif-hash on a refund-shaped payload with 401 and never invokes the processor', async () => {
    const body = JSON.stringify({ id: 77, AmountRefunded: 2000, status: 'completed-bank-transfer', FlwRef: 'FLW-REF-1', TransactionId: 999 });
    const res = await app.request('/webhooks/flutterwave', {
      method: 'POST',
      headers: { 'verif-hash': 'forged' },
      body,
    });
    expect(res.status).toBe(401);
    expect(processRefundWebhookEventMock).not.toHaveBeenCalled();
  });

  it('rejects a missing verif-hash on a refund-shaped payload with 401', async () => {
    const body = JSON.stringify({ id: 77, AmountRefunded: 2000, status: 'completed-bank-transfer', FlwRef: 'FLW-REF-1', TransactionId: 999 });
    const res = await app.request('/webhooks/flutterwave', { method: 'POST', body });
    expect(res.status).toBe(401);
    expect(processRefundWebhookEventMock).not.toHaveBeenCalled();
  });

  it('rejects a forged verif-hash with 401 and never invokes the processor', async () => {
    const body = JSON.stringify({ event: { type: 'CARD_TRANSACTION' }, data: { tx_ref: 'PANTRA-x', id: 1 } });
    const res = await app.request('/webhooks/flutterwave', {
      method: 'POST',
      headers: { 'verif-hash': 'forged' },
      body,
    });
    expect(res.status).toBe(401);
    expect(processVerifiedPaymentMock).not.toHaveBeenCalled();
  });

  it('accepts a matching verif-hash, invokes the processor once, and acknowledges with 200', async () => {
    const body = JSON.stringify({ event: { type: 'CARD_TRANSACTION' }, data: { tx_ref: 'PANTRA-flw-1', id: 55 } });
    const res = await app.request('/webhooks/flutterwave', {
      method: 'POST',
      headers: { 'verif-hash': 'flw-configured-hash-for-webhook-tests' },
      body,
    });

    expect(res.status).toBe(200);
    expect(processVerifiedPaymentMock).toHaveBeenCalledTimes(1);
    expect(processVerifiedPaymentMock.mock.calls[0][0]).toMatchObject({
      provider: 'flutterwave',
      reference: 'PANTRA-flw-1',
      sourceChannel: 'webhook',
      providerEventId: '55',
    });
  });
});

// Flutterwave's account-wide refund webhook is OFF by default per their own
// docs (requires contacting their support to enable) — callbackurl is the
// per-request alternative needing no such setup, so this route exists as a
// distinct, more-reliably-delivered path. It intentionally has no signature
// check (none is documented for callbackurl), which is exactly why it must
// never apply a transition from the payload directly — see
// processFlutterwaveRefundCallback's own doc comment for the safety
// argument (it can only ever trigger a live re-verification).
describe('POST /webhooks/flutterwave-refund-callback', () => {
  beforeEach(() => {
    processFlutterwaveRefundCallbackMock.mockReset();
    processFlutterwaveRefundCallbackMock.mockResolvedValue(undefined);
  });

  it('accepts an unsigned callback POST and forwards it to the SAME refund processor used by the real webhook', async () => {
    const body = JSON.stringify({ id: 77, AmountRefunded: 2000, status: 'completed-bank-transfer', FlwRef: 'FLW-REF-1', TransactionId: 999 });
    const res = await app.request('/webhooks/flutterwave-refund-callback', { method: 'POST', body });

    expect(res.status).toBe(200);
    expect(processFlutterwaveRefundCallbackMock).toHaveBeenCalledTimes(1);
  });

  it('a malformed body returns 400 rather than crashing', async () => {
    const res = await app.request('/webhooks/flutterwave-refund-callback', { method: 'POST', body: 'not json' });
    expect(res.status).toBe(400);
    expect(processFlutterwaveRefundCallbackMock).not.toHaveBeenCalled();
  });

  it('an infrastructure failure inside processing surfaces as a 5xx, not a 200', async () => {
    processFlutterwaveRefundCallbackMock.mockRejectedValue(new Error('Supabase temporarily unavailable'));
    const body = JSON.stringify({ id: 77, AmountRefunded: 2000, status: 'completed-bank-transfer', FlwRef: 'FLW-REF-1', TransactionId: 999 });
    const res = await app.request('/webhooks/flutterwave-refund-callback', { method: 'POST', body });
    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});
