import { adminProcedure } from "../../../../../create-context";
import { createTrafficRule, createTrafficRuleInput } from "../../../../../../services/admin/pricing";

export default adminProcedure
  .input(createTrafficRuleInput)
  .mutation(({ ctx, input }) => createTrafficRule(ctx.supabaseAdmin, input));
