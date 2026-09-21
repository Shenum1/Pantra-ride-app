import { z } from "zod";
import { adminProcedure } from "../../../../../create-context";
import { reconcileOneRefund } from "../../../../../../lib/refund-processor";

export default adminProcedure
  .input(z.object({ refundId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    return reconcileOneRefund(ctx.supabaseAdmin, input.refundId);
  });
