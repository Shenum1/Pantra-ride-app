import { adminProcedure } from "../../../../create-context";
import { listPromotions, listPromotionsInput } from "../../../../../services/admin/promotions";

export default adminProcedure
  .input(listPromotionsInput.optional())
  .query(({ ctx, input }) => listPromotions(ctx.supabaseAdmin, input));
