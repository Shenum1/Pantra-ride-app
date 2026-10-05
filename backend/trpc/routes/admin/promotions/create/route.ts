import { adminProcedure } from "../../../../create-context";
import { createPromotion, createPromotionInput } from "../../../../../services/admin/promotions";

export default adminProcedure
  .input(createPromotionInput)
  .mutation(({ ctx, input }) => createPromotion(ctx.supabaseAdmin, input));
