import { adminProcedure } from "../../../../create-context";
import { updatePromotion, updatePromotionInput } from "../../../../../services/admin/promotions";

export default adminProcedure
  .input(updatePromotionInput)
  .mutation(({ ctx, input }) => updatePromotion(ctx.supabaseAdmin, input));
