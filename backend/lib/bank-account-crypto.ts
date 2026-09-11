import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// AES-256-GCM encryption for driver bank account numbers at rest. Server-only
// — this file must never be imported by any client-bundled code (app/, lib/
// files reachable from React Native, admin-web/). Key comes from
// BANK_ACCOUNT_ENCRYPTION_KEY (see .env.example), never hardcoded here or in
// any SQL migration.
//
// Output format: base64(iv[12] | authTag[16] | ciphertext) — a single opaque
// string, so callers/columns don't need to track iv/tag separately.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const raw = process.env.BANK_ACCOUNT_ENCRYPTION_KEY ?? '';
  if (!raw) {
    throw new Error('BANK_ACCOUNT_ENCRYPTION_KEY is not configured on the server.');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('BANK_ACCOUNT_ENCRYPTION_KEY must decode to exactly 32 bytes (e.g. `openssl rand -base64 32`).');
  }
  return key;
}

export function encryptAccountNumber(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decryptAccountNumber(encrypted: string): string {
  const key = getKey();
  const buffer = Buffer.from(encrypted, 'base64');
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = buffer.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function accountNumberLast4(accountNumber: string): string {
  return accountNumber.slice(-4);
}
