import { adminProcedure } from "../../../../../create-context";
import { getSingleRowConfig, SINGLE_ROW_PRICING_TABLES } from "../../../../../../services/admin/pricing";

export default adminProcedure.query(async ({ ctx }) => ({
  config: await getSingleRowConfig(ctx.supabaseAdmin, SINGLE_ROW_PRICING_TABLES.surge),
}));
