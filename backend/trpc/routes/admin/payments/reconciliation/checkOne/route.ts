import { z } from "zod";
import { adminProcedure } from "../../../../../create-context";
import { processVerifiedPayment } from "../../../../../../lib/payment-processor";

// The one reconciliation path that re-verifies an intent REGARDLESS of its
// stored status — specifically to catch the case a normal sweep can never
// reach: a payment_intents row already 'successful' in Pantra, whose
// provider now reports the underlying charge as failed (e.g. a later
// chargeback-like reversal, or a data inconsistency worth investigating).
// Never mutates the immutable 'successful' intent itself — only ever
// writes a payment_reconciliation_records row if a contradiction is found.
export default adminProcedure
  .input(z.object({ reference: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const { data: intent, error } = await ctx.supabaseAdmin
      .from("payment_intents")
      .select("provider")
      .eq("reference", input.reference)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!intent) return { status: false, message: "No payment intent found for this reference." };

    const result = await processVerifiedPayment({
      supabaseAdmin: ctx.supabaseAdmin,
      provider: intent.provider,
      reference: input.reference,
      sourceChannel: "admin_reconciliation",
      eventType: "reconciliation_spot_check",
      forceRecheck: true,
    });

    return result;
  });
