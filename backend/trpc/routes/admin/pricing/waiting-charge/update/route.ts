import { adminProcedure } from "../../../../../create-context";
import { updateWaitingCharge, updateWaitingChargeInput } from "../../../../../../services/admin/pricing";

export default adminProcedure
  .input(updateWaitingChargeInput)
  .mutation(({ ctx, input }) => updateWaitingCharge(ctx.supabaseAdmin, input));
