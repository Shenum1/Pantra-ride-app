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

process.env.PAYSTACK_SECRET_KEY = 'sk_test_shared_secret_for_webhook_tests';
process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH = 'flw-configured-hash-for-webhook-tests';

const { default: app } = await import('@/backend/hono');

describe('POST /webhooks/paystack', () => {
  beforeEach(() => {
    processVerifiedPaymentMock.mockReset();
    processVerifiedPaymentMock.mockResolvedValue({ status: true, message: 'ok' });
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
