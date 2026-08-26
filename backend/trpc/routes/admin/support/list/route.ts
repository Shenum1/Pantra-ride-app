import { z } from "zod";
import { adminProcedure } from "../../../../create-context";

export default adminProcedure
  .input(
    z.object({
      status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
      priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    })
  )
  .query(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    let query = db
      .from("support_tickets")
      .select(
        "id, filedByUserId, filedByRole, filedByName, subject, category, status, priority, createdAt, updatedAt",
        { count: "exact" }
      )
      .order("updatedAt", { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);

    if (input.status) query = query.eq("status", input.status);
    if (input.priority) query = query.eq("priority", input.priority);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    return { tickets: data ?? [], total: count ?? 0 };
  });
