import { adminProcedure } from "../../../../create-context";
import { completePayoutManually, completePayoutManuallyInput } from "../../../../../services/admin/payouts";

export default adminProcedure
  .input(completePayoutManuallyInput)
  .mutation(({ ctx, input }) => completePayoutManually(ctx.supabaseAdmin, ctx.adminUserId, input));
