import { z } from "zod";
import { adminProcedure } from "../../../../create-context";

export default adminProcedure
  .input(
    z
      .object({
        activeOnly: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
      .optional()
  )
  .query(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const limit = input?.limit ?? 50;
    const offset = input?.offset ?? 0;

    let query = db
      .from("promotions")
      .select("*", { count: "exact" })
      .order("createdAt", { ascending: false })
      .range(offset, offset + limit - 1);

    if (input?.activeOnly) {
      query = query.eq("isActive", true);
    }

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);
    return { promotions: data ?? [], total: count ?? 0 };
  });
