import { z } from "zod";
import { adminProcedure } from "../../../../../create-context";

export default adminProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      label: z.string().min(1).optional(),
      daysOfWeek: z.array(z.number().min(0).max(6)).nullable().optional(),
      startMinute: z.number().min(0).max(1439).nullable().optional(),
      endMinute: z.number().min(0).max(1439).nullable().optional(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
      multiplier: z.number().min(0.1).max(10).optional(),
      isEnabled: z.boolean().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const { id, ...updates } = input;
    const { error } = await db
      .from("traffic_multiplier_rules")
      .update({ ...updates, updatedAt: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
