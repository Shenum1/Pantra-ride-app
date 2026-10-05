import { adminProcedure } from "../../../../../create-context";
import { listPricingTiers } from "../../../../../../services/admin/pricing";

export default adminProcedure.query(({ ctx }) => listPricingTiers(ctx.supabaseAdmin));
