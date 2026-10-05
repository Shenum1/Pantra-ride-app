import { adminProcedure } from "../../../../../create-context";
import { updateCancellationFee, updateCancellationFeeInput } from "../../../../../../services/admin/pricing";

export default adminProcedure
  .input(updateCancellationFeeInput)
  .mutation(({ ctx, input }) => updateCancellationFee(ctx.supabaseAdmin, input));
