import { adminProcedure } from "../../../../../create-context";
import { updatePriorityFee, updatePriorityFeeInput } from "../../../../../../services/admin/pricing";

export default adminProcedure
  .input(updatePriorityFeeInput)
  .mutation(({ ctx, input }) => updatePriorityFee(ctx.supabaseAdmin, input));
