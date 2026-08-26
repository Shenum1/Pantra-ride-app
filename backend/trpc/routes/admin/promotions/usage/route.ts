import { z } from "zod";
import { adminProcedure } from "../../../../create-context";

export default adminProcedure
  .input(
    z.object({
      promoId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    })
  )
  .query(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    const { data, count, error } = await db
      .from("user_promo_uses")
      .select("id, userId, rideId, usedAt", { count: "exact" })
      .eq("promoId", input.promoId)
      .order("usedAt", { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);

    if (error) throw new Error(error.message);

    const userIds = [...new Set((data ?? []).map((u) => u.userId).filter(Boolean))];
    const usersRes = userIds.length
      ? await db.from("users").select("uid, displayName, email").in("uid", userIds)
      : { data: [] as { uid: string; displayName: string | null; email: string | null }[] };
    const userMap = new Map((usersRes.data ?? []).map((u) => [u.uid, u.displayName || u.email || u.uid]));

    const uses = (data ?? []).map((u) => ({
      ...u,
      userName: userMap.get(u.userId) ?? u.userId,
    }));

    return { uses, total: count ?? 0 };
  });
