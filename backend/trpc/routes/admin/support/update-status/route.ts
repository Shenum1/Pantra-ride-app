import { adminProcedure } from "../../../../create-context";
import { updateSupportTicketStatus, updateSupportTicketStatusInput } from "../../../../../services/admin/support";

export default adminProcedure
  .input(updateSupportTicketStatusInput)
  .mutation(({ ctx, input }) => updateSupportTicketStatus(ctx.supabaseAdmin, ctx.adminUserId, input));
