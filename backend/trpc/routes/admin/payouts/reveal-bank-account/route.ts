import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminProcedure } from "../../../../create-context";
import { decryptAccountNumber } from "../../../../../lib/bank-account-crypto";
import { recordAdminAccess } from "../../../../../lib/admin-access-log";

// On-demand reveal only — admin.payouts.list intentionally returns
// accountNumberLast4, not the full number, so the plaintext isn't sitting in
// every list row's response/DOM. An admin still legitimately needs the real
// number at point of action (drivers are paid manually), so this decrypts
// exactly one row per call, and every reveal is recorded in admin_access_log.
//
// Reads ONLY accountNumberEncrypted — the legacy plaintext "accountNumber"
// column is being dropped (database/schemas/
// supabase-schema-bank-accounts-drop-plaintext.sql) once
// scripts/backfill-bank-account-encryption.ts has encrypted every row.
export async function revealBankAccount(db: SupabaseClient, adminUserId: string, bankAccountId: string) {
  const { data, error } = await db
    .from("driver_bank_accounts")
    .select("id, accountNumberEncrypted")
    .eq("id", bankAccountId)
    .maybeSingle();

  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
  if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Bank account not found." });
  if (!data.accountNumberEncrypted) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This bank account has no encrypted account number. Run the bank-account encryption backfill.",
    });
  }

  const accountNumber = decryptAccountNumber(data.accountNumberEncrypted);

  await recordAdminAccess(db, {
    adminUserId,
    action: "reveal_bank_account",
    subjectType: "driver_bank_account",
    subjectId: bankAccountId,
  });

  return { accountNumber };
}

export default adminProcedure
  .input(z.object({ bankAccountId: z.string().uuid() }))
  .mutation(({ ctx, input }) => revealBankAccount(ctx.supabaseAdmin, ctx.adminUserId, input.bankAccountId));
