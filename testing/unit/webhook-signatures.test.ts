import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';

const ORIGINAL_PAYSTACK_KEY = process.env.PAYSTACK_SECRET_KEY;
const ORIGINAL_FLW_HASH = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;

describe('verifyPaystackSignature', () => {
  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_shared_secret';
  });
  afterEach(() => {
    process.env.PAYSTACK_SECRET_KEY = ORIGINAL_PAYSTACK_KEY;
  });

  it('accepts a correctly-signed raw body', async () => {
    const { verifyPaystackSignature } = await import('@/backend/lib/webhook-signatures');
    const rawBody = JSON.stringify({ event: 'charge.success', data: { reference: 'PANTRA-abc', amount: 100000 } });
    const signature = createHmac('sha512', 'sk_test_shared_secret').update(rawBody, 'utf8').digest('hex');
    expect(verifyPaystackSignature(rawBody, signature)).toBe(true);
  });

  it('rejects a tampered body against the original signature', async () => {
    const { verifyPaystackSignature } = await import('@/backend/lib/webhook-signatures');
    const rawBody = JSON.stringify({ event: 'charge.success', data: { reference: 'PANTRA-abc', amount: 100000 } });
    const signature = createHmac('sha512', 'sk_test_shared_secret').update(rawBody, 'utf8').digest('hex');
    const tamperedBody = JSON.stringify({ event: 'charge.success', data: { reference: 'PANTRA-abc', amount: 999999999 } });
    expect(verifyPaystackSignature(tamperedBody, signature)).toBe(false);
  });

  it('rejects a signature computed with the wrong key', async () => {
    const { verifyPaystackSignature } = await import('@/backend/lib/webhook-signatures');
    const rawBody = JSON.stringify({ event: 'charge.success', data: { reference: 'PANTRA-abc' } });
    const forgedSignature = createHmac('sha512', 'attacker-guessed-key').update(rawBody, 'utf8').digest('hex');
    expect(verifyPaystackSignature(rawBody, forgedSignature)).toBe(false);
  });

  it('rejects a missing signature header', async () => {
    const { verifyPaystackSignature } = await import('@/backend/lib/webhook-signatures');
    expect(verifyPaystackSignature('{}', null)).toBe(false);
    expect(verifyPaystackSignature('{}', undefined)).toBe(false);
  });

  it('rejects when PAYSTACK_SECRET_KEY is not configured', async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    const { verifyPaystackSignature } = await import('@/backend/lib/webhook-signatures');
    expect(verifyPaystackSignature('{}', 'anything')).toBe(false);
  });

  it('does not throw on a malformed/short-length forged header (length mismatch)', async () => {
    const { verifyPaystackSignature } = await import('@/backend/lib/webhook-signatures');
    expect(() => verifyPaystackSignature('{}', 'short')).not.toThrow();
    expect(verifyPaystackSignature('{}', 'short')).toBe(false);
  });
});

describe('verifyFlutterwaveSignature', () => {
  beforeEach(() => {
    process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH = 'my-configured-webhook-hash';
  });
  afterEach(() => {
    process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH = ORIGINAL_FLW_HASH;
  });

  it('accepts a header matching the configured hash', async () => {
    const { verifyFlutterwaveSignature } = await import('@/backend/lib/webhook-signatures');
    expect(verifyFlutterwaveSignature('my-configured-webhook-hash')).toBe(true);
  });

  it('rejects a header that does not match', async () => {
    const { verifyFlutterwaveSignature } = await import('@/backend/lib/webhook-signatures');
    expect(verifyFlutterwaveSignature('attacker-guess')).toBe(false);
  });

  it('rejects a missing header', async () => {
    const { verifyFlutterwaveSignature } = await import('@/backend/lib/webhook-signatures');
    expect(verifyFlutterwaveSignature(null)).toBe(false);
    expect(verifyFlutterwaveSignature(undefined)).toBe(false);
  });

  it('rejects when FLUTTERWAVE_WEBHOOK_SECRET_HASH is not configured', async () => {
    delete process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
    const { verifyFlutterwaveSignature } = await import('@/backend/lib/webhook-signatures');
    expect(verifyFlutterwaveSignature('anything')).toBe(false);
  });
});
