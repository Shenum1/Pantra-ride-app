import { z } from "zod";
import { adminProcedure } from "../../../../create-context";
import { reconcileOnePayout } from "../../../../../lib/payout-processor";

// The ONLY way a payout can be marked completed by an admin — replaces the
// old admin.payouts.updateStatus generic setter entirely. Requires the
// payout to already be in manual_review (reached via the automatic path
// failing, or admin.payouts.moveToManualReview), an external transfer
// reference, and — critically — a live re-check against Paystack right
// before completing, so an admin can never manually complete a payout whose
// automatic transfer actually already succeeded (the double-payment case
// the spec is most explicit about). Every completion is recorded in
// payout_manual_actions with the admin's own id — an immutable audit trail,
// not a free-text status edit.
export default adminProcedure
  .input(
    z.object({
      payoutId: z.string().uuid(),
      externalReference: z.string().min(1),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    const { data: payout, error } = await db
      .from("driver_payouts")
      .select("id, status, provider, providerTransferReference")
      .eq("id", input.payoutId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!payout) throw new Error("Payout not found.");

    if (payout.status === "completed") {
      throw new Error("This payout is already completed.");
    }
    if (payout.status !== "manual_review") {
      throw new Error(
        `Payout must be in manual_review before it can be completed manually (currently ${payout.status}). Use admin.payouts.moveToManualReview first.`
      );
    }

    // If an automatic transfer was ever attempted for this payout, verify
    // with Paystack RIGHT NOW that it didn't actually succeed — never trust
    // stale local state for this specific check. reconcileOnePayout will
    // itself apply the 'completed' transition if Paystack confirms success,
    // which is exactly the outcome we want: the manual completion below is
    // then correctly refused because the payout is no longer manual_review.
    if (payout.provider === "paystack" && payout.providerTransferReference) {
      await reconcileOnePayout(db, input.payoutId);

      const { data: recheck, error: recheckError } = await db
        .from("driver_payouts")
        .select("status")
        .eq("id", input.payoutId)
        .single();
      if (recheckError) throw new Error(recheckError.message);

      if (recheck.status !== "manual_review") {
        throw new Error(
          `Refused: the provider re-check moved this payout to '${recheck.status}' — an automatic transfer may already have succeeded. Manual completion was NOT applied.`
        );
      }
    }

    const { error: updateError } = await db.from("driver_payouts").update({ status: "completed" }).eq("id", input.payoutId);
    if (updateError) throw new Error(updateError.message);

    await db.from("payout_manual_actions").insert({
      payoutId: input.payoutId,
      adminUserId: ctx.adminUserId,
      action: "manual_completed",
      externalReference: input.externalReference,
      notes: input.notes ?? null,
    });

    return { success: true };
  });
