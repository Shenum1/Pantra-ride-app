import { z } from "zod";
import { adminProcedure } from "../../../../create-context";
import { reconcileOnePayout } from "../../../../../lib/payout-processor";

// The ONLY way a payout can be marked completed by an admin — replaces the
// old admin.payouts.updateStatus generic setter entirely. Requires the
// payout to already be in manual_review (reached via the automatic path
// failing, or admin.payouts.moveToManualReview), an external transfer
// reference, and — critically — a live re-check against the payout's
// provider right before completing, so an admin can never manually complete a payout whose
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
      // Required only when the provider can't be asked whether an automatic
      // transfer went out (see reconcileOnePayout's `unverifiable`): the
      // admin attests they searched the provider's dashboard for this
      // payout's reference and found no transfer. Recorded in the audit row.
      confirmedNoProviderTransfer: z.boolean().optional(),
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
    // with its provider RIGHT NOW that it didn't actually succeed — never
    // trust stale local state for this specific check. reconcileOnePayout
    // will itself apply the 'completed' transition if the provider confirms
    // success, which is exactly the outcome we want: the manual completion
    // below is then correctly refused because the payout is no longer
    // manual_review. Must cover every provider that can initiate transfers —
    // a provider missing here would silently skip this double-payment check.
    let providerConfirmationNote: string | null = null;
    if ((payout.provider === "paystack" || payout.provider === "flutterwave") && payout.providerTransferReference) {
      const check = await reconcileOnePayout(db, input.payoutId);

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

      // The provider couldn't be asked, and a transfer may exist (e.g. an
      // automatic attempt timed out before Flutterwave returned its id).
      // Paying manually now risks paying the driver twice — only a human
      // who has checked the provider's dashboard can rule that out.
      if (check.unverifiable) {
        if (!input.confirmedNoProviderTransfer) {
          throw new Error(
            `Refused: an automatic ${payout.provider} transfer may already have been sent for this payout and Pantra can't look it up. Search the ${payout.provider} dashboard for reference ${payout.providerTransferReference}, and only complete manually after confirming no transfer was sent. Manual completion was NOT applied.`
          );
        }
        providerConfirmationNote = `Admin confirmed in the ${payout.provider} dashboard that no transfer was sent for reference ${payout.providerTransferReference}.`;
      }
    }

    const { error: updateError } = await db.from("driver_payouts").update({ status: "completed" }).eq("id", input.payoutId);
    if (updateError) throw new Error(updateError.message);

    await db.from("payout_manual_actions").insert({
      payoutId: input.payoutId,
      adminUserId: ctx.adminUserId,
      action: "manual_completed",
      externalReference: input.externalReference,
      notes: [providerConfirmationNote, input.notes].filter(Boolean).join(" ") || null,
    });

    return { success: true };
  });
