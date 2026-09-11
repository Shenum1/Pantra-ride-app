// One-off, manually-run backfill: encrypts every driver_bank_accounts row
// that still only has a plaintext "accountNumber" (pre-encryption rows),
// populating "accountNumberEncrypted"/"accountNumberLast4".
//
// Run AFTER supabase-schema-driver-bank-accounts-encryption.sql has been
// applied, and BEFORE the follow-up migration that drops the plaintext
// "accountNumber" column. Requires SUPABASE_SERVICE_ROLE_KEY and
// BANK_ACCOUNT_ENCRYPTION_KEY to be set (.env or the shell environment).
//
// Usage:  node scripts/backfill-bank-account-encryption.mjs
//
// After running, verify with:
//   select count(*) from driver_bank_accounts where "accountNumberEncrypted" is null;
// must return 0 before dropping the plaintext column.
//
// The AES-256-GCM implementation here intentionally mirrors
// backend/lib/bank-account-crypto.ts exactly (same algorithm, same
// iv|authTag|ciphertext base64 layout) — this is a plain .mjs script with no
// TS build step, so it can't import that file directly. Keep both in sync.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createCipheriv, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function loadLocalEnv() {
  for (const file of ['.env', 'env']) {
    const envPath = path.resolve(process.cwd(), file);
    if (!existsSync(envPath)) continue;
    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separator = trimmed.indexOf('=');
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator);
      const value = trimmed.slice(separator + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadLocalEnv();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const encryptionKeyB64 = process.env.BANK_ACCOUNT_ENCRYPTION_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
if (!encryptionKeyB64) {
  console.error('Missing BANK_ACCOUNT_ENCRYPTION_KEY. Generate one with `openssl rand -base64 32` and set it before running this script.');
  process.exit(1);
}

const key = Buffer.from(encryptionKeyB64, 'base64');
if (key.length !== 32) {
  console.error('BANK_ACCOUNT_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  process.exit(1);
}

function encryptAccountNumber(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: rows, error } = await supabase
  .from('driver_bank_accounts')
  .select('id, accountNumber')
  .is('accountNumberEncrypted', null);

if (error) {
  console.error('Failed to fetch rows:', error.message);
  process.exit(1);
}

if (!rows || rows.length === 0) {
  console.log('No rows need backfilling. Safe to proceed with the follow-up migration.');
  process.exit(0);
}

console.log(`Backfilling ${rows.length} row(s)...`);

let succeeded = 0;
let failed = 0;

for (const row of rows) {
  if (!row.accountNumber) {
    console.warn(`Row ${row.id} has no plaintext accountNumber to backfill from — skipping.`);
    failed++;
    continue;
  }

  const { error: updateError } = await supabase
    .from('driver_bank_accounts')
    .update({
      accountNumberEncrypted: encryptAccountNumber(row.accountNumber),
      accountNumberLast4: row.accountNumber.slice(-4),
    })
    .eq('id', row.id);

  if (updateError) {
    console.error(`Row ${row.id} failed:`, updateError.message);
    failed++;
  } else {
    succeeded++;
  }
}

console.log(`Done. Succeeded: ${succeeded}, Failed: ${failed}.`);
if (failed > 0) {
  console.error('Some rows failed to backfill — do NOT drop the plaintext accountNumber column until this is resolved.');
  process.exit(1);
}
console.log('Verify with: select count(*) from driver_bank_accounts where "accountNumberEncrypted" is null; (must be 0) before dropping the plaintext column.');
