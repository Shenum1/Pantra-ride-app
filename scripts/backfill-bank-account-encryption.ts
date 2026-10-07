// One-off, manually-run backfill: encrypts every driver_bank_accounts AND
// wallet_bank_accounts row that still only has a plaintext "accountNumber",
// populating "accountNumberEncrypted"/"accountNumberLast4" with the same
// AES-256-GCM scheme the backend uses (backend/lib/bank-account-crypto.ts).
// SQL can't do this — the key never goes into the database.
//
// Order:
//   1. database/schemas/supabase-schema-backend-hardening.sql
//   2. THIS SCRIPT (dry run first, then for real)
//   3. database/schemas/supabase-schema-bank-accounts-drop-plaintext.sql
//
// Env (from .env / env in the cwd, or the shell):
//   EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   BANK_ACCOUNT_ENCRYPTION_KEY  — must be the SAME key the deployed backend
//                                  uses, or the backend can't decrypt.
//
// Usage:
//   bun scripts/backfill-bank-account-encryption.ts --dry-run
//   bun scripts/backfill-bank-account-encryption.ts
//
// Re-runnable: only rows with accountNumberEncrypted IS NULL are touched.
// Exits 1 if any row failed — do NOT run the drop migration until it exits 0.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { BACKFILL_TABLES, backfillTable } from "../backend/lib/bank-account-backfill";

function loadLocalEnv() {
  for (const file of [".env", "env"]) {
    const envPath = path.resolve(process.cwd(), file);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator);
      if (!process.env[key]) process.env[key] = trimmed.slice(separator + 1);
    }
  }
}

async function main() {
  loadLocalEnv();
  const dryRun = process.argv.includes("--dry-run");

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  if (!process.env.BANK_ACCOUNT_ENCRYPTION_KEY) {
    console.error("Missing BANK_ACCOUNT_ENCRYPTION_KEY (must match the deployed backend's key).");
    process.exit(1);
  }

  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  let anyFailed = false;
  for (const table of BACKFILL_TABLES) {
    const result = await backfillTable(db, table, { dryRun, log: (m) => console.warn(m) });
    console.log(
      `${table}: scanned ${result.scanned}, ${dryRun ? "would encrypt" : "encrypted"} ${result.encrypted}, ` +
        `skipped (empty) ${result.skippedEmpty}, failed ${result.failed.length}`
    );
    for (const f of result.failed) console.error(`  ${table} ${f.id}: ${f.reason}`);
    if (result.failed.length > 0) anyFailed = true;
  }

  if (anyFailed) {
    console.error("Some rows failed — do NOT run supabase-schema-bank-accounts-drop-plaintext.sql until this exits 0.");
    process.exit(1);
  }
  if (dryRun) {
    console.log("Dry run only — nothing written. Re-run without --dry-run.");
  } else {
    console.log(
      'Done. Verify, for each table: select count(*) from <table> where "accountNumber" is not null and "accountNumberEncrypted" is null; (must be 0), then run the drop migration.'
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
