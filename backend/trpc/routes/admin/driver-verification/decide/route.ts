import { adminProcedure } from "../../../../create-context";
import { decideDriverVerification, decideDriverVerificationInput } from "../../../../../services/admin/driver-verification";

export default adminProcedure
  .input(decideDriverVerificationInput)
  .mutation(({ ctx, input }) => decideDriverVerification(ctx.supabaseAdmin, ctx.adminUserId, input));
