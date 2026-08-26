import { z } from "zod";
import { adminProcedure } from "../../../../create-context";

export default adminProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      description: z.string().min(1).optional(),
      discountPercentage: z.number().min(0).max(100).optional(),
      maxDiscountNGN: z.number().min(0).nullable().optional(),
      maxUses: z.number().min(1).nullable().optional(),
      validUntil: z.string().optional(),
      isActive: z.boolean().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const { id, ...updates } = input;
    const { error } = await db.from("promotions").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
