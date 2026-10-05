import { adminProcedure } from "../../../../../create-context";
import { updateCommissionRate, updateCommissionRateInput } from "../../../../../../services/admin/pricing";

export default adminProcedure
  .input(updateCommissionRateInput)
  .mutation(({ ctx, input }) => updateCommissionRate(ctx.supabaseAdmin, input));
