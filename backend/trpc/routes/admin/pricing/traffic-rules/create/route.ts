import { z } from "zod";
import { adminProcedure } from "../../../../../create-context";

export default adminProcedure
  .input(
    z.object({
      label: z.string().min(1),
      daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
      startMinute: z.number().min(0).max(1439).optional(),
      endMinute: z.number().min(0).max(1439).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      multiplier: z.number().min(0.1).max(10),
      isEnabled: z.boolean().default(true),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const { error } = await db.from("traffic_multiplier_rules").insert({
      label: input.label,
      daysOfWeek: input.daysOfWeek ?? null,
      startMinute: input.startMinute ?? null,
      endMinute: input.endMinute ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      multiplier: input.multiplier,
      isEnabled: input.isEnabled,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });
