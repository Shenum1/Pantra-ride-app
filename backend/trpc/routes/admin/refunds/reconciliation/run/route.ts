import { z } from "zod";
import { adminProcedure } from "../../../../../create-context";
import { reconcileOneRefund } from "../../../../../../lib/refund-processor";

// Refund counterpart to admin.payments.reconciliation.run / admin.payouts.reconciliation.run.
// Only ever applies to provider-backed (wallet_topup) refunds — a
// ride_wallet_payment refund is synchronous and never leaves 'processing'
// for more than the duration of a single RPC call.
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

    const { data: staleRefunds, error } = await db
      .from("refund_intents")
      .select("id")
      .eq("originalPaymentType", "wallet_topup")
      .in("status", ["processing", "unknown"])
      .lt("updatedAt", cutoff)
      .limit(input.limit);

    if (error) throw new Error(error.message);

    const results = [];
    for (const refund of staleRefunds ?? []) {
      const result = await reconcileOneRefund(db, refund.id);
      results.push({ refundId: refund.id, status: result.status, message: result.message });
    }

    return { checked: results.length, results };
  });
