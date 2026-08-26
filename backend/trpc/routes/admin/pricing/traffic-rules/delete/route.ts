import { z } from "zod";
import { adminProcedure } from "../../../../../create-context";

export default adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const { error } = await db.from("traffic_multiplier_rules").delete().eq("id", input.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
