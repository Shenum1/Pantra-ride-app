import { z } from "zod";
import { adminProcedure } from "../../../../create-context";
import { moveToManualReview } from "../../../../../lib/payout-processor";

// Lets an admin explicitly pull a payout out of the automatic path (e.g. they
// know in advance it needs special handling) — the only other way a payout
// reaches manual_review is the automatic path failing on its own.
export default adminProcedure
  .input(z.object({ payoutId: z.string().uuid(), reason: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const { data: payout, error } = await ctx.supabaseAdmin
      .from("driver_payouts")
      .select("id, status")
      .eq("id", input.payoutId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!payout) throw new Error("Payout not found.");
    if (payout.status !== "pending" && payout.status !== "processing") {
      throw new Error(`Payout is already ${payout.status} and cannot be moved to manual review.`);
    }

    await moveToManualReview(ctx.supabaseAdmin, input.payoutId, input.reason, ctx.adminUserId);
    return { success: true };
  });
