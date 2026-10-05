import { adminProcedure } from "../../../create-context";
import { reviewDriverDocument, reviewDriverDocumentInput } from "../../../../services/admin/driver-verification";

export default adminProcedure
  .input(reviewDriverDocumentInput)
  .mutation(({ ctx, input }) => reviewDriverDocument(ctx.supabaseAdmin, ctx.adminUserId, input));
