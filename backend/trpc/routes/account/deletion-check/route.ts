import { TRPCError } from "@trpc/server";
import { authedProcedure } from "../../../create-context";

// What would stop the signed-in user deleting their account right now
// (a trip in progress, money in the wallet, a payout on its way, ...). The
// delete screen shows these before asking for confirmation. The codes are
// listed in account_deletion_blockers (supabase/migrations/20261009000100_account_deletion.sql).
export default authedProcedure.query(async ({ ctx }) => {
  const { data, error } = await ctx.supabaseAdmin.rpc("account_deletion_blockers", { p_user_id: ctx.userId });
  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
  return { blockers: (data ?? []) as string[] };
});
