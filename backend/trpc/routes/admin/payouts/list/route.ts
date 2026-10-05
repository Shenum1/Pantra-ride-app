import { adminProcedure } from "../../../../create-context";
import { listPayouts, listPayoutsInput } from "../../../../../services/admin/payouts";

export default adminProcedure
  .input(listPayoutsInput)
  .query(({ ctx, input }) => listPayouts(ctx.supabaseAdmin, input));
