import { adminProcedure } from "../../../../create-context";
import { getDriverVerificationDetail, getDriverVerificationDetailInput } from "../../../../../services/admin/driver-verification";

export default adminProcedure
  .input(getDriverVerificationDetailInput)
  .query(({ ctx, input }) => getDriverVerificationDetail(ctx.supabaseAdmin, input));
