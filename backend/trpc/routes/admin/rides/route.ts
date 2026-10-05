import { adminProcedure } from "../../../create-context";
import { listTrips, listTripsInput } from "../../../../services/admin/trips";

export default adminProcedure
  .input(listTripsInput)
  .query(({ ctx, input }) => listTrips(ctx.supabaseAdmin, input));
