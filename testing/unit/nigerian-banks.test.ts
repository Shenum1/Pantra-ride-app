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
});
