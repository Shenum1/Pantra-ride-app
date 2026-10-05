import { adminProcedure } from "../../../../create-context";
import { replyToSupportTicket, replyToSupportTicketInput } from "../../../../../services/admin/support";

export default adminProcedure
  .input(replyToSupportTicketInput)
  .mutation(({ ctx, input }) => replyToSupportTicket(ctx.supabaseAdmin, ctx.adminUserId, input));
