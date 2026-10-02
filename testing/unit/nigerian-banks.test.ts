import { describe, expect, it } from 'vitest';
import { resolveBankCode } from '@/backend/lib/nigerian-banks';

describe('resolveBankCode', () => {
  it('resolves common exact bank names', () => {
    expect(resolveBankCode('GTBank')).toBe('058');
    expect(resolveBankCode('Zenith Bank')).toBe('057');
    expect(resolveBankCode('Access Bank')).toBe('044');
    expect(resolveBankCode('UBA')).toBe('033');
  });

  it('is case-insensitive and tolerant of Plc/Limited/Nigeria suffixes', () => {
    expect(resolveBankCode('zenith bank plc')).toBe('057');
    expect(resolveBankCode('GUARANTY TRUST BANK NIGERIA')).toBe('058');
    expect(resolveBankCode('  Access Bank Limited  ')).toBe('044');
  });

  it('resolves fintech/microfinance banks a driver is likely to type', () => {
    expect(resolveBankCode('Kuda')).toBe('50211');
    expect(resolveBankCode('Opay')).toBe('999992');
    expect(resolveBankCode('Moniepoint')).toBe('50515');
  });

  it('returns null for an unresolvable name rather than guessing', () => {
    expect(resolveBankCode('My Local Cooperative Society')).toBeNull();
    expect(resolveBankCode('')).toBeNull();
  });

  // Codes verified live against Flutterwave's sandbox GET /v3/banks/NG.
  it('resolves Flutterwave codes for the fintech/MFB banks whose codes differ from Paystack', () => {
    expect(resolveBankCode('Kuda', 'flutterwave')).toBe('090267');
    expect(resolveBankCode('Opay', 'flutterwave')).toBe('100004');
    expect(resolveBankCode('PalmPay', 'flutterwave')).toBe('100033');
    expect(resolveBankCode('Moniepoint MFB', 'flutterwave')).toBe('090405');
    expect(resolveBankCode('VFD', 'flutterwave')).toBe('090110');
    expect(resolveBankCode('Globus Bank', 'flutterwave')).toBe('103');
    expect(resolveBankCode('Titan Trust Bank', 'flutterwave')).toBe('000025');
  });

  it('never routes a Flutterwave Taj Bank payout to 302, which is a different bank (Eartholeum) on Flutterwave', () => {
    expect(resolveBankCode('Taj Bank', 'paystack')).toBe('302');
    expect(resolveBankCode('Taj Bank', 'flutterwave')).toBe('000026');
  });

  it('commercial-bank codes are identical on both providers', () => {
    for (const name of ['GTBank', 'Access Bank', 'Zenith', 'First Bank', 'UBA', 'Fidelity', 'Sterling', 'Wema', 'FCMB']) {
      expect(resolveBankCode(name, 'flutterwave')).toBe(resolveBankCode(name, 'paystack'));
    }
  });

  it('defaults to Paystack codes so existing callers are unchanged', () => {
    expect(resolveBankCode('Kuda')).toBe(resolveBankCode('Kuda', 'paystack'));
  });

  it('returns null for an unresolvable name on Flutterwave too', () => {
    expect(resolveBankCode('My Local Cooperative Society', 'flutterwave')).toBeNull();
  });
});
