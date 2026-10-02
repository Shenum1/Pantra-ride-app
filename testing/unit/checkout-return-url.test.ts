import { describe, expect, it, afterEach } from 'vitest';
import { resolveCheckoutReturnUrl } from '@/backend/lib/flutterwave-checkout';

const DEFAULT = 'https://pantraride.space/payment-callback';

describe('resolveCheckoutReturnUrl — where Flutterwave sends the user after checkout', () => {
  const originalBase = process.env.PANTRA_API_BASE_URL;
  afterEach(() => {
    process.env.PANTRA_API_BASE_URL = originalBase;
  });

  it("accepts the app's own links so the in-app checkout sheet can close itself", () => {
    expect(resolveCheckoutReturnUrl('pantra://payment-callback')).toBe('pantra://payment-callback');
    expect(resolveCheckoutReturnUrl('exp://192.168.0.10:8081/--/payment-callback')).toBe('exp://192.168.0.10:8081/--/payment-callback');
  });

  it("accepts Pantra's own web callback, and localhost for web development", () => {
    expect(resolveCheckoutReturnUrl('https://pantraride.space/payment-callback')).toBe('https://pantraride.space/payment-callback');
    expect(resolveCheckoutReturnUrl('https://www.pantraride.space/payment-callback')).toBe('https://www.pantraride.space/payment-callback');
    expect(resolveCheckoutReturnUrl('http://localhost:8081/payment-callback')).toBe('http://localhost:8081/payment-callback');
  });

  it("accepts the configured backend host (e.g. a staging domain)", () => {
    process.env.PANTRA_API_BASE_URL = 'https://staging.pantraride.space';
    expect(resolveCheckoutReturnUrl('https://staging.pantraride.space/payment-callback')).toBe('https://staging.pantraride.space/payment-callback');
  });

  it('never lets a client point a Pantra checkout at an arbitrary site', () => {
    expect(resolveCheckoutReturnUrl('https://evil.example.com/payment-callback')).toBe(DEFAULT);
    expect(resolveCheckoutReturnUrl('https://pantraride.space.evil.example.com/x')).toBe(DEFAULT);
    expect(resolveCheckoutReturnUrl('http://pantraride.space/payment-callback')).toBe(DEFAULT); // not https
    expect(resolveCheckoutReturnUrl('javascript:alert(1)')).toBe(DEFAULT);
    expect(resolveCheckoutReturnUrl('not a url')).toBe(DEFAULT);
  });

  it('falls back to the production web callback when none is given', () => {
    expect(resolveCheckoutReturnUrl(undefined)).toBe(DEFAULT);
    expect(resolveCheckoutReturnUrl('')).toBe(DEFAULT);
  });
});
