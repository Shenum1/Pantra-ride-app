import { adminProcedure } from "../../../../create-context";

export default adminProcedure.query(async ({ ctx }) => {
  const db = ctx.supabaseAdmin;
  const { data, error } = await db
    .from("app_video_config")
    .select("*")
    .order("screenKey", { ascending: true })
    .order("sortOrder", { ascending: true });
  if (error) throw new Error(error.message);
  return { videos: data ?? [] };
});
