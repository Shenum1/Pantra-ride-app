import { describe, expect, it, beforeAll } from 'vitest';
import { randomBytes } from 'crypto';

// BANK_ACCOUNT_ENCRYPTION_KEY must be set before backend/lib/bank-account-crypto.ts
// is imported (it's read lazily inside each call, but set it up-front for clarity).
beforeAll(() => {
  process.env.BANK_ACCOUNT_ENCRYPTION_KEY = randomBytes(32).toString('base64');
});

describe('bank-account-crypto', () => {
  it('round-trips a plaintext account number', async () => {
    const { encryptAccountNumber, decryptAccountNumber } = await import('@/backend/lib/bank-account-crypto');
    const plain = '0123456789';
    const encrypted = encryptAccountNumber(plain);
    expect(decryptAccountNumber(encrypted)).toBe(plain);
  });

  it('never leaks the plaintext digits inside the ciphertext', async () => {
    const { encryptAccountNumber } = await import('@/backend/lib/bank-account-crypto');
    const plain = '0123456789';
    const encrypted = encryptAccountNumber(plain);
    expect(encrypted).not.toContain(plain);
  });

  it('produces different ciphertext for the same input each time (random IV)', async () => {
    const { encryptAccountNumber } = await import('@/backend/lib/bank-account-crypto');
    const plain = '0123456789';
    const a = encryptAccountNumber(plain);
    const b = encryptAccountNumber(plain);
    expect(a).not.toBe(b);
  });

  it('rejects decryption with a tampered ciphertext (auth tag mismatch)', async () => {
    const { encryptAccountNumber, decryptAccountNumber } = await import('@/backend/lib/bank-account-crypto');
    const encrypted = encryptAccountNumber('0123456789');
    const buffer = Buffer.from(encrypted, 'base64');
    buffer[buffer.length - 1] ^= 0xff; // flip the last ciphertext byte
    const tampered = buffer.toString('base64');
    expect(() => decryptAccountNumber(tampered)).toThrow();
  });

  it('throws a clear error when the encryption key is not configured', async () => {
    const original = process.env.BANK_ACCOUNT_ENCRYPTION_KEY;
    delete process.env.BANK_ACCOUNT_ENCRYPTION_KEY;
    try {
      const { encryptAccountNumber } = await import('@/backend/lib/bank-account-crypto');
      expect(() => encryptAccountNumber('0123456789')).toThrow(/not configured/i);
    } finally {
      process.env.BANK_ACCOUNT_ENCRYPTION_KEY = original;
    }
  });

  it('accountNumberLast4 returns the last 4 digits', async () => {
    const { accountNumberLast4 } = await import('@/backend/lib/bank-account-crypto');
    expect(accountNumberLast4('0123456789')).toBe('6789');
  });
});
