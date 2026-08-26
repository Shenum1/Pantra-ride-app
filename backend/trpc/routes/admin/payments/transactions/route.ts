import { z } from "zod";
import { adminProcedure } from "../../../../create-context";

export default adminProcedure
  .input(
    z.object({
      type: z.enum(["credit", "debit", "refund", "cashback", "ride_payment", "add_money", "withdraw", "tip"]).optional(),
      status: z.enum(["completed", "pending", "failed"]).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    })
  )
  .query(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    let query = db
      .from("wallet_transactions")
      .select("id, userId, type, amount, description, status, rideId, reference, createdAt", { count: "exact" })
      .order("createdAt", { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);

    if (input.type) query = query.eq("type", input.type);
    if (input.status) query = query.eq("status", input.status);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    const userIds = [...new Set((data ?? []).map((t) => t.userId).filter(Boolean))];
    const usersRes = userIds.length
      ? await db.from("users").select("uid, displayName, email").in("uid", userIds)
      : { data: [] as { uid: string; displayName: string | null; email: string | null }[] };
    const userMap = new Map((usersRes.data ?? []).map((u) => [u.uid, u.displayName || u.email || u.uid]));

    const transactions = (data ?? []).map((t) => ({
      ...t,
      userName: t.userId ? userMap.get(t.userId) ?? t.userId : null,
    }));

    return { transactions, total: count ?? 0 };
  });
