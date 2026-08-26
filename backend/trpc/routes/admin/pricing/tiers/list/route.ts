import { adminProcedure } from "../../../../../create-context";

export default adminProcedure.query(async ({ ctx }) => {
  const db = ctx.supabaseAdmin;
  const { data, error } = await db.from("pricing_tier_config").select("*").order("id");
  if (error) throw new Error(error.message);
  return { tiers: data ?? [] };
});
