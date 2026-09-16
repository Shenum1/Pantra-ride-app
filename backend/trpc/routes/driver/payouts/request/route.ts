import { z } from "zod";
import { driverProcedure } from "../../../../create-context";
import { initiateAutomaticPayout, moveToManualReview } from "../../../../../lib/payout-processor";
import { DRIVER_PAYOUT_CONFIG } from "../../../../../../lib/pricing-config";

// Replaces DriverWalletService.requestWithdrawal's previous direct
// `supabase.from('driver_payouts').insert(...)` client call (see
// docs/PAYMENT_FINANCIAL_ARCHITECTURE_AUDIT.md and
// supabase-schema-driver-payouts-automation.sql, which revokes the RLS
// policy that made that possible). Moving this server-side does two things:
// the server — never the client — determines available balance, amount
// validity, and bank-account ownership before any row is created (the
// existing driver_payouts_check_balance trigger + advisory lock still fire
// exactly as before, unchanged), and it lets automatic payout initiation run
// synchronously in the same request instead of needing a separate trigger
// mechanism to notice a new row.
export default driverProcedure
  .input(
    z.object({
      bankAccountId: z.string().uuid(),
      amount: z.number().finite().positive(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    const amount = Math.round(input.amount * 100) / 100;
    if (amount < DRIVER_PAYOUT_CONFIG.minAmount) {
      throw new Error(`Minimum withdrawal amount is ₦${DRIVER_PAYOUT_CONFIG.minAmount}.`);
    }

    // Ownership check — a driver may only request a payout to a bank account
    // that is actually theirs, never one supplied by id alone and trusted.
    const { data: bankAccount, error: bankAccountError } = await db
      .from("driver_bank_accounts")
      .select("id")
      .eq("id", input.bankAccountId)
      .eq("driverId", ctx.driverId)
      .maybeSingle();
    if (bankAccountError) throw new Error(bankAccountError.message);
    if (!bankAccount) {
      throw new Error("This bank account was not found on your profile.");
    }

    const { data: payout, error: insertError } = await db
      .from("driver_payouts")
      .insert({
        driverId: ctx.driverId,
        amount,
        bankAccountId: input.bankAccountId,
        status: "pending",
        payoutMethod: "automatic",
      })
      .select("id, driverId, amount, bankAccountId, status, requestedAt")
      .single();

    if (insertError) {
      // The balance-guard trigger (driver_payouts_check_balance) raises here
      // when the amount exceeds the driver's actual available balance —
      // surfaced as a plain error message, same as before this route
      // existed.
      throw new Error(insertError.message);
    }

    try {
      await initiateAutomaticPayout(db, payout.id);
    } catch (error) {
      // A genuine failure inside initiation (not a provider rejection, which
      // initiateAutomaticPayout already handles by moving to manual_review —
      // this is an unexpected exception, e.g. a DB write failing) must not
      // silently leave the payout stuck 'pending' with no automatic attempt
      // ever recorded. Fall back to manual_review so a human notices it.
      console.error(`payout ${payout.id}: automatic initiation threw unexpectedly:`, error);
      await moveToManualReview(db, payout.id, "Automatic initiation failed unexpectedly — requires manual processing.");
    }

    const { data: finalPayout, error: refetchError } = await db
      .from("driver_payouts")
      .select("id, driverId, amount, bankAccountId, status, provider, providerTransferReference, requestedAt")
      .eq("id", payout.id)
      .single();
    if (refetchError) throw new Error(refetchError.message);

    return finalPayout;
  });
