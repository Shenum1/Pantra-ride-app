import { adminProcedure } from "../../../../../create-context";
import { updatePricingTier, updatePricingTierInput } from "../../../../../../services/admin/pricing";

export default adminProcedure
  .input(updatePricingTierInput)
  .mutation(({ ctx, input }) => updatePricingTier(ctx.supabaseAdmin, input));
