import { z } from "zod";
import { adminProcedure } from "../../../../../create-context";

export default adminProcedure
  .input(z.object({ id: z.string().uuid(), fee: z.number().min(0), isEnabled: z.boolean() }))
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const { error } = await db
      .from("pricing_priority_config")
      .update({ fee: input.fee, isEnabled: input.isEnabled, updatedAt: new Date().toISOString() })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
