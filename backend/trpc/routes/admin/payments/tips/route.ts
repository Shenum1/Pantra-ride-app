import { z } from "zod";
import { adminProcedure } from "../../../../create-context";

export default adminProcedure
  .input(
    z.object({
      status: z.enum(["pending", "successful", "failed", "cancelled", "refunded"]).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    })
  )
  .query(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    let query = db
      .from("tips")
      .select("id, rideId, riderId, driverId, amount, status, createdAt", { count: "exact" })
      .order("createdAt", { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);

    if (input.status) query = query.eq("status", input.status);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    const riderIds = [...new Set((data ?? []).map((t) => t.riderId).filter(Boolean))];
    const driverIds = [...new Set((data ?? []).map((t) => t.driverId).filter(Boolean))];

    const [ridersRes, driversRes] = await Promise.all([
      riderIds.length
        ? db.from("users").select("uid, displayName, email").in("uid", riderIds)
        : Promise.resolve({ data: [] as { uid: string; displayName: string | null; email: string | null }[] }),
      driverIds.length
        ? db.from("drivers").select("id, name, email").in("id", driverIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null; email: string | null }[] }),
    ]);

    const riderMap = new Map((ridersRes.data ?? []).map((u) => [u.uid, u.displayName || u.email || u.uid]));
    const driverMap = new Map((driversRes.data ?? []).map((d) => [d.id, d.name || d.email || d.id]));

    const tips = (data ?? []).map((t) => ({
      ...t,
      riderName: riderMap.get(t.riderId) ?? t.riderId,
      driverName: driverMap.get(t.driverId) ?? t.driverId,
    }));

    return { tips, total: count ?? 0 };
  });
