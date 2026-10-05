import { adminProcedure } from "../../../../create-context";
import { listDriversForVerification, listDriversForVerificationInput } from "../../../../../services/admin/driver-verification";

export default adminProcedure
  .input(listDriversForVerificationInput.optional())
  .query(({ ctx, input }) => listDriversForVerification(ctx.supabaseAdmin, input));
