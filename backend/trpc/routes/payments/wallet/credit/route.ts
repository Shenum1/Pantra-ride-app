import { z } from "zod";
import { authedProcedure } from "../../../../create-context";
import { processVerifiedPayment } from "../../../../../lib/payment-processor";

// The client-facing recovery/immediate-UX-confirmation path. The webhook
// routes (backend/hono.ts) are now the PRIMARY confirmation mechanism —
// this route exists so a rider who successfully completes checkout and
// returns to the app doesn't have to wait for webhook delivery to see their
// balance update. Both paths converge on the exact same
// processVerifiedPayment — there is no separate wallet-credit
// implementation here.
export default authedProcedure
  .input(
    z.object({
      gateway: z.enum(["paystack", "flutterwave"]),
      reference: z.string().min(1),
      paymentMethodId: z.string().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const result = await processVerifiedPayment({
      supabaseAdmin: ctx.supabaseAdmin,
      provider: input.gateway,
      reference: input.reference,
      sourceChannel: "client_verification",
      callingUserId: ctx.userId,
      paymentMethodId: input.paymentMethodId,
      eventType: "client_verify",
    });

    return { status: result.status, message: result.message, transaction: result.transaction };
  });
