// One-off, read-only check that the Supabase setup steps from the report's
// "Setup Steps Required" section have been completed:
//   1. wallets / ratings / driver_documents tables exist (migrations ran)
//   2. a private "documents" storage bucket exists
//   3. the given email has role = 'admin' in public.users
//
// Usage: node scripts/verify-setup.mjs [admin-email]
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import ws from 'ws';

if (!globalThis.WebSocket) {
  globalThis.WebSocket = ws;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(path) {
  const env = {};
  const content = readFileSync(path, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv(join(__dirname, '..', '.env'));
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.argv[2] ?? 'gabrielfanda8@gmail.com';

if (!url || !serviceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function checkTable(table) {
  const { error, count } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, message: `exists (${count ?? 0} rows)` };
}

async function checkBucket() {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    return { ok: false, message: error.message };
  }
  const bucket = data?.find((b) => b.name === 'documents');
  if (!bucket) {
    return { ok: false, message: 'no "documents" bucket found' };
  }
  return { ok: !bucket.public, message: `found (public=${bucket.public})` };
}

async function checkAdmin(email) {
  const { data, error } = await supabase.from('users').select('role,email').eq('email', email).maybeSingle();
  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data) {
    return { ok: false, message: `no user row found for ${email}` };
  }
  return { ok: data.role === 'admin', message: `role="${data.role}"` };
}

const results = {
  'wallets table (wallet migration)': await checkTable('wallets'),
  'ratings table (ratings migration)': await checkTable('ratings'),
  'driver_documents table (driver-documents migration)': await checkTable('driver_documents'),
  '"documents" storage bucket (private)': await checkBucket(),
  [`admin role for ${adminEmail}`]: await checkAdmin(adminEmail),
};

console.log('\nSupabase setup verification:\n');
for (const [label, result] of Object.entries(results)) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} — ${label}: ${result.message}`);
}

const allOk = Object.values(results).every((r) => r.ok);
process.exit(allOk ? 0 : 1);
