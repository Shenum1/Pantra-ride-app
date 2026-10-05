import { adminProcedure } from "../../../create-context";
import { getOperationsOverview } from "../../../../services/admin/overview";

export default adminProcedure.query(({ ctx }) => getOperationsOverview(ctx.supabaseAdmin));
