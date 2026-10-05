import { adminProcedure } from "../../../../create-context";
import { failPayoutManually, failPayoutManuallyInput } from "../../../../../services/admin/payouts";

export default adminProcedure
  .input(failPayoutManuallyInput)
  .mutation(({ ctx, input }) => failPayoutManually(ctx.supabaseAdmin, ctx.adminUserId, input));
