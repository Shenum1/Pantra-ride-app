import { adminProcedure } from "../../../../create-context";
import { getPromotionUsage, getPromotionUsageInput } from "../../../../../services/admin/promotions";

export default adminProcedure
  .input(getPromotionUsageInput)
  .query(({ ctx, input }) => getPromotionUsage(ctx.supabaseAdmin, input));
