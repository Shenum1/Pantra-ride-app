import { adminProcedure } from "../../../../../create-context";
import { updateSurgeConfig, updateSurgeConfigInput } from "../../../../../../services/admin/pricing";

export default adminProcedure
  .input(updateSurgeConfigInput)
  .mutation(({ ctx, input }) => updateSurgeConfig(ctx.supabaseAdmin, input));
