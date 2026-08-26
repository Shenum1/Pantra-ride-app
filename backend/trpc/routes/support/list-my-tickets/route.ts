import { authedProcedure } from "../../../create-context";

export default authedProcedure.query(async ({ ctx }) => {
  const db = ctx.supabaseAdmin;
  const { data, error } = await db
    .from("support_tickets")
    .select("id, subject, category, status, priority, createdAt, updatedAt")
    .eq("filedByUserId", ctx.userId)
    .order("createdAt", { ascending: false });

  if (error) throw new Error(error.message);
  return { tickets: data ?? [] };
});
