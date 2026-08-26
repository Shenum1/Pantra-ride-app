import { z } from "zod";
import { adminProcedure } from "../../../../../create-context";

export default adminProcedure
  .input(z.object({ id: z.string().uuid(), rate: z.number().min(0).max(1) }))
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const { error } = await db
      .from("platform_commission_config")
      .update({ rate: input.rate, updatedAt: new Date().toISOString() })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
