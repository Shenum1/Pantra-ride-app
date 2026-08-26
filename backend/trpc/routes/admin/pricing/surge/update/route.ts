import { z } from "zod";
import { adminProcedure } from "../../../../../create-context";

export default adminProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      minMultiplier: z.number().min(1),
      maxMultiplier: z.number().min(1),
      highDemandRatio: z.number().min(0),
      lowDemandRatio: z.number().min(0),
      lowAcceptanceThreshold: z.number().min(0).max(1),
      lowAcceptanceBonus: z.number().min(0),
      acceptanceLookbackMinutes: z.number().min(1),
      isEnabled: z.boolean(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const { id, ...updates } = input;
    const { error } = await db
      .from("surge_config")
      .update({ ...updates, updatedAt: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
