import { z } from "zod";
import { adminProcedure } from "../../../../../create-context";
import { processVerifiedPayment } from "../../../../../../lib/payment-processor";

// Does not duplicate detection logic — re-invokes the same idempotent
// processVerifiedPayment used by webhooks and client verification for every
// stale non-terminal intent. Provider-success-but-not-yet-credited cases
// self-heal for real (a genuine credit happens, safely, via the same path
// every other caller uses); genuine mismatches are recorded by that
// function itself. Never touches an already-terminal ('successful'/
// 'failed') intent — see admin.payments.reconciliation.checkOne for the one
// case (a successful intent the provider later disowns) that requires an
// explicit, named spot-check instead.
export default adminProcedure
  .input(
    z.object({
      olderThanMinutes: z.number().min(1).max(1440).default(15),
      limit: z.number().min(1).max(100).default(50),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const cutoff = new Date(Date.now() - input.olderThanMinutes * 60 * 1000).toISOString();

    const { data: staleIntents, error } = await db
      .from("payment_intents")
      .select("id, provider, reference")
      .in("status", ["initialized", "pending", "unknown", "cancelled", "expired"])
      .lt("createdAt", cutoff)
      .limit(input.limit);

    if (error) throw new Error(error.message);

    const results = [];
    for (const intent of staleIntents ?? []) {
      const result = await processVerifiedPayment({
        supabaseAdmin: db,
        provider: intent.provider,
        reference: intent.reference,
        sourceChannel: "admin_reconciliation",
        eventType: "reconciliation_sweep",
      });
      results.push({ reference: intent.reference, provider: intent.provider, status: result.status, message: result.message });
    }

    return { checked: results.length, results };
  });
