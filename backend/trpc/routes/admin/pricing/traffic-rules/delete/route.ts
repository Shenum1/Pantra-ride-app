import { adminProcedure } from "../../../../../create-context";
import { deleteTrafficRule, deleteTrafficRuleInput } from "../../../../../../services/admin/pricing";

export default adminProcedure
  .input(deleteTrafficRuleInput)
  .mutation(({ ctx, input }) => deleteTrafficRule(ctx.supabaseAdmin, input));
