import { adminProcedure } from "../../../../../create-context";
import { updateTrafficRule, updateTrafficRuleInput } from "../../../../../../services/admin/pricing";

export default adminProcedure
  .input(updateTrafficRuleInput)
  .mutation(({ ctx, input }) => updateTrafficRule(ctx.supabaseAdmin, input));
