import { z } from "zod";
import { adminProcedure } from "../../../../create-context";
import { decryptAccountNumber } from "../../../../../lib/bank-account-crypto";

// On-demand reveal only — admin.payouts.list intentionally returns
// accountNumberLast4, not the full number, so the plaintext isn't sitting in
// every list row's response/DOM. An admin still legitimately needs the real
// number at point of action (Phase 1 has no automated bank transfer — the
// admin wires the money manually), so this decrypts exactly one row per call.
export default adminProcedure
  .input(z.object({ bankAccountId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabaseAdmin
      .from("driver_bank_accounts")
      .select("accountNumberEncrypted, accountNumber")
      .eq("id", input.bankAccountId)
      .single();

    if (error) throw new Error(error.message);

    const accountNumber = data.accountNumberEncrypted
      ? decryptAccountNumber(data.accountNumberEncrypted)
      : data.accountNumber; // pre-backfill legacy row — still plaintext

    return { accountNumber };
  });
