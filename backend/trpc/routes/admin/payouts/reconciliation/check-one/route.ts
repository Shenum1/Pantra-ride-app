import { z } from "zod";
import { adminProcedure } from "../../../../../create-context";
import { reconcileOnePayout } from "../../../../../../lib/payout-processor";

// On-demand spot check for one payout by id — used by admin.payouts.completeManually
// internally, and exposed here directly so an admin can investigate a
// specific payout ("investigate unknown payout" in the spec) without waiting
// for the sweep's threshold.
export default adminProcedure
  .input(z.object({ payoutId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    return reconcileOnePayout(ctx.supabaseAdmin, input.payoutId);
  });
