import { z } from "zod";
import { adminProcedure } from "../../../../create-context";

export default adminProcedure
  .input(
    z.object({
      code: z.string().min(3).max(20),
      description: z.string().min(1),
      discountPercentage: z.number().min(0).max(100),
      maxDiscountNGN: z.number().min(0).optional(),
      maxUses: z.number().min(1).optional(),
      validFrom: z.string().optional(),
      validUntil: z.string(),
      isActive: z.boolean().default(true),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const { error } = await db.from("promotions").insert({
      code: input.code.toUpperCase(),
      description: input.description,
      discountPercentage: input.discountPercentage,
      maxDiscountNGN: input.maxDiscountNGN ?? null,
      maxUses: input.maxUses ?? null,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      isActive: input.isActive,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });
