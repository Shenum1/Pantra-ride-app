import type { SupabaseClient } from "@supabase/supabase-js";
import { accountNumberLast4, decryptAccountNumber, encryptAccountNumber } from "./bank-account-crypto";

// One-off backfill core, driven by scripts/backfill-bank-account-encryption.ts.
// Encrypts every row that still only has a plaintext "accountNumber" into
// "accountNumberEncrypted" (+ "accountNumberLast4"), for both bank-account
// tables. Lives in backend/lib (not the script) so it reuses the real
// AES-256-GCM implementation in bank-account-crypto.ts and is unit-testable.
//
// Must run AFTER supabase-schema-backend-hardening.sql (which adds the
// encrypted columns to wallet_bank_accounts) and BEFORE
// supabase-schema-bank-accounts-drop-plaintext.sql (which refuses to run
// while any row still has plaintext and no ciphertext).

export const BACKFILL_TABLES = ["driver_bank_accounts", "wallet_bank_accounts"] as const;
export type BackfillTable = (typeof BACKFILL_TABLES)[number];

export interface BackfillResult {
  table: BackfillTable;
  scanned: number;
  encrypted: number;
  // Rows with neither plaintext nor ciphertext — nothing to encrypt, and
  // they don't block the drop migration (its guard only counts rows that
  // still hold plaintext).
  skippedEmpty: number;
  failed: { id: string; reason: string }[];
}

const PAGE_SIZE = 500;

export async function backfillTable(
  db: SupabaseClient,
  table: BackfillTable,
  opts: { dryRun?: boolean; log?: (msg: string) => void } = {}
): Promise<BackfillResult> {
  const log = opts.log ?? (() => {});
  const result: BackfillResult = { table, scanned: 0, encrypted: 0, skippedEmpty: 0, failed: [] };

  // Keyset pagination on id: rows we encrypt drop out of the
  // "accountNumberEncrypted is null" filter, so offset paging would skip rows.
  let lastId: string | null = null;
  for (;;) {
    let query = db
      .from(table)
      .select("id, accountNumber")
      .is("accountNumberEncrypted", null)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (lastId) query = query.gt("id", lastId);

    const { data: rows, error } = await query;
    if (error) throw new Error(`${table}: failed to fetch rows: ${error.message}`);
    if (!rows || rows.length === 0) break;

    for (const row of rows as { id: string; accountNumber: string | null }[]) {
      result.scanned++;
      lastId = row.id;

      const plain = typeof row.accountNumber === "string" ? row.accountNumber.trim() : "";
      if (!plain) {
        result.skippedEmpty++;
        log(`${table} ${row.id}: no plaintext accountNumber — nothing to encrypt, skipping.`);
        continue;
      }

      let ciphertext: string;
      try {
        ciphertext = encryptAccountNumber(plain);
        // Never write a ciphertext we can't read back.
        if (decryptAccountNumber(ciphertext) !== plain) throw new Error("round-trip mismatch");
      } catch (e) {
        result.failed.push({ id: row.id, reason: `encryption failed: ${(e as Error).message}` });
        continue;
      }

      if (opts.dryRun) {
        result.encrypted++;
        continue;
      }

      // Conditional on the row still being unencrypted, so a concurrent
      // write through the backend route is never overwritten.
      const { error: updateError } = await db
        .from(table)
        .update({ accountNumberEncrypted: ciphertext, accountNumberLast4: accountNumberLast4(plain) })
        .eq("id", row.id)
        .is("accountNumberEncrypted", null);

      if (updateError) {
        result.failed.push({ id: row.id, reason: updateError.message });
      } else {
        result.encrypted++;
      }
    }

    if (rows.length < PAGE_SIZE) break;
  }

  return result;
}
