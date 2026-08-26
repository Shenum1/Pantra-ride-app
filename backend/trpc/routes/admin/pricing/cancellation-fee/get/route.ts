import { adminProcedure } from "../../../../../create-context";

export default adminProcedure.query(async ({ ctx }) => {
  const db = ctx.supabaseAdmin;
  const { data, error } = await db.from("cancellation_fee_config").select("*").single();
  if (error) throw new Error(error.message);
  return { config: data };
});
