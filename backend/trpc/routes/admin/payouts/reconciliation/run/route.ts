import { z } from "zod";
import { adminProcedure } from "../../../../../create-context";
import { reconcileOnePayout } from "../../../../../../lib/payout-processor";

// Payout counterpart to admin.payments.reconciliation.run — sweeps payouts
// stuck 'processing' past a threshold and asks Paystack directly what it
// knows. Never sends money: only recognizes provider-confirmed
// success/failure/reversal that already happened via the same
// reconcileOnePayout function the webhook-timeout recovery path and
// .checkOne both use.
export default adminProcedure
  .input(
    z.object({
      olderThanMinutes: z.number().min(1).max(1440).default(30),
      limit: z.number().min(1).max(100).default(50),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const cutoff = new Date(Date.now() - input.olderThanMinutes * 60 * 1000).toISOString();

    const { data: stalePayouts, error } = await db
      .from("driver_payouts")
      .select("id")
      .eq("status", "processing")
      .lt("processingStartedAt", cutoff)
      .limit(input.limit);

    if (error) throw new Error(error.message);

    const results = [];
    for (const payout of stalePayouts ?? []) {
      const result = await reconcileOnePayout(db, payout.id);
      results.push({ payoutId: payout.id, status: result.status, message: result.message });
    }

    return { checked: results.length, results };
  });
