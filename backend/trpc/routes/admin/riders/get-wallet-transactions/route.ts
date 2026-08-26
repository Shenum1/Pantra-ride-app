import { z } from "zod";
import { adminProcedure } from "../../../../create-context";

export default adminProcedure
  .input(
    z.object({
      riderId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    })
  )
  .query(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;
    const { data, count, error } = await db
      .from("wallet_transactions")
      .select("id, type, amount, description, status, rideId, reference, createdAt", { count: "exact" })
      .eq("userId", input.riderId)
      .order("createdAt", { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);

    if (error) throw new Error(error.message);
    return { transactions: data ?? [], total: count ?? 0 };
  });
