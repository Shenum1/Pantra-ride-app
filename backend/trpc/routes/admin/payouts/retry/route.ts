import { z } from "zod";
import { adminProcedure } from "../../../../create-context";
import { initiateAutomaticPayout } from "../../../../../lib/payout-processor";

// Re-attempts the AUTOMATIC path for a payout that previously failed or
// landed in manual_review — this is the "safely retryable failed payout"
// action from the spec. Reuses the payout's existing
// providerTransferReference if one was already generated (so Paystack's own
// duplicate-reference protection still applies on the retry); a payout that
// never got that far (e.g. bank code never resolved) generates one fresh
// inside initiateAutomaticPayout as normal.
export default adminProcedure
  .input(z.object({ payoutId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    const { data: payout, error } = await db
      .from("driver_payouts")
      .select("id, status")
      .eq("id", input.payoutId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!payout) throw new Error("Payout not found.");
    if (payout.status !== "failed" && payout.status !== "manual_review") {
      throw new Error(`Payout must be failed or in manual_review to retry (currently ${payout.status}).`);
    }

    const { error: transitionError } = await db.from("driver_payouts").update({ status: "processing" }).eq("id", input.payoutId);
    if (transitionError) throw new Error(transitionError.message);

    await db.from("payout_manual_actions").insert({
      payoutId: input.payoutId,
      adminUserId: ctx.adminUserId,
      action: "retry_initiated",
    });

    await initiateAutomaticPayout(db, input.payoutId);

    const { data: finalPayout, error: refetchError } = await db
      .from("driver_payouts")
      .select("id, status, provider, providerTransferReference")
      .eq("id", input.payoutId)
      .single();
    if (refetchError) throw new Error(refetchError.message);

    return finalPayout;
  });
