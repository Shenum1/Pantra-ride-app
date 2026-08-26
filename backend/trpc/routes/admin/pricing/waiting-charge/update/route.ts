import { z } from "zod";
import { adminProcedure } from "../../../../../create-context";

export default adminProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      graceMinutes: z.number().min(0),
      perMinuteRate: z.number().min(0),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const { id, ...updates } = input;
    const { error } = await db
      .from("waiting_charge_config")
      .update({ ...updates, updatedAt: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
