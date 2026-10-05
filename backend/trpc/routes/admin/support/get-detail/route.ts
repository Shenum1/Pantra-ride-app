import { adminProcedure } from "../../../../create-context";
import { getSupportTicket, getSupportTicketInput } from "../../../../../services/admin/support";

export default adminProcedure
  .input(getSupportTicketInput)
  .query(({ ctx, input }) => getSupportTicket(ctx.supabaseAdmin, input));
