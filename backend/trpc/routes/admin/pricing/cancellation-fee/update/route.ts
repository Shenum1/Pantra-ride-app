import { z } from "zod";
import { adminProcedure } from "../../../../../create-context";

export default adminProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      freeWindowSeconds: z.number().min(0),
      afterAcceptFee: z.number().min(0),
      afterArrivalFee: z.number().min(0),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const { id, ...updates } = input;
    const { error } = await db
      .from("cancellation_fee_config")
      .update({ ...updates, updatedAt: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
