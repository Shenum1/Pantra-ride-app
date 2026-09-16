import { z } from "zod";
import { adminProcedure } from "../../../../create-context";

// Marks a payout in manual_review as failed (e.g. the driver's bank details
// turned out to be invalid and no transfer is possible). Releases the
// reservation — get_driver_available_balance excludes 'failed' — so the
// driver can request again with corrected details.
export default adminProcedure
  .input(z.object({ payoutId: z.string().uuid(), reason: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    const { data: payout, error } = await db
      .from("driver_payouts")
      .select("id, status")
      .eq("id", input.payoutId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!payout) throw new Error("Payout not found.");
    if (payout.status !== "manual_review") {
      throw new Error(`Payout must be in manual_review to be failed manually (currently ${payout.status}).`);
    }

    const { error: updateError } = await db
      .from("driver_payouts")
      .update({ status: "failed", failureReason: input.reason })
      .eq("id", input.payoutId);
    if (updateError) throw new Error(updateError.message);

    await db.from("payout_manual_actions").insert({
      payoutId: input.payoutId,
      adminUserId: ctx.adminUserId,
      action: "manual_failed",
      notes: input.reason,
    });

    return { success: true };
  });
