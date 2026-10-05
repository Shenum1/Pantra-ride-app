import { adminProcedure } from "../../../create-context";
import { listDriverDocuments, listDriverDocumentsInput } from "../../../../services/admin/driver-verification";

export default adminProcedure
  .input(listDriverDocumentsInput.optional())
  .query(({ ctx, input }) => listDriverDocuments(ctx.supabaseAdmin, input));
