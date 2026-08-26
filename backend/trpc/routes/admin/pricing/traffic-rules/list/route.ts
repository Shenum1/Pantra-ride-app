import { adminProcedure } from "../../../../../create-context";

export default adminProcedure.query(async ({ ctx }) => {
  const db = ctx.supabaseAdmin;
  const { data, error } = await db.from("traffic_multiplier_rules").select("*").order("label");
  if (error) throw new Error(error.message);
  return { rules: data ?? [] };
});
