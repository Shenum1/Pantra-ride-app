import { adminProcedure } from "../../../../../create-context";
import { listTrafficRules } from "../../../../../../services/admin/pricing";

export default adminProcedure.query(({ ctx }) => listTrafficRules(ctx.supabaseAdmin));
