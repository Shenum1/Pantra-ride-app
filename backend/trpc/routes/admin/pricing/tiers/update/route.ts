import { z } from "zod";
import { adminProcedure } from "../../../../../create-context";

export default adminProcedure
  .input(
    z.object({
      id: z.enum(["standard", "comfort", "xl"]),
      base: z.number().min(0),
      perKm: z.number().min(0),
      perMin: z.number().min(0),
      minFare: z.number().min(0),
      bookingFee: z.number().min(0),
      serviceFee: z.number().min(0),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const { id, ...updates } = input;
    const { error } = await db
      .from("pricing_tier_config")
      .update({ ...updates, updatedAt: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
