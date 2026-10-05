import { adminProcedure } from "../../../../create-context";
import { listSupportTickets, listSupportTicketsInput } from "../../../../../services/admin/support";

export default adminProcedure
  .input(listSupportTicketsInput)
  .query(({ ctx, input }) => listSupportTickets(ctx.supabaseAdmin, input));
