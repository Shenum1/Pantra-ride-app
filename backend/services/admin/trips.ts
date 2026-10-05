import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export const listTripsInput = z.object({
  status: z
    .enum(["pending", "accepted", "in-progress", "completed", "cancelled"])
    .optional()
    .describe("Only return trips in this lifecycle status. Omit for all statuses."),
  limit: z.number().int().min(1).max(100).default(50).describe("Maximum number of trips to return (1-100), newest first."),
  offset: z.number().int().min(0).default(0).describe("Number of trips to skip, for pagination."),
});

export async function listTrips(db: SupabaseClient, input: z.infer<typeof listTripsInput>) {
  let query = db
    .from("rides")
    .select(
      "id, userId, driverId, pickupAddress, dropoffAddress, rideType, status, fare, baseFare, minFare, maxFare, bookingFee, serviceFee, zoneFee, waitingCharge, priorityFee, cancellationFee, fareAdjustmentPercent, distance, duration, paymentMethod, paymentStatus, createdAt, acceptedAt, arrivedAt, startedAt, completedAt, cancelledAt, cancelReason, cancelReasonDetails, platformCommissionRate, platformCommissionAmount, driverEarningsAmount",
      { count: "exact" }
    )
    .order("createdAt", { ascending: false })
    .range(input.offset, input.offset + input.limit - 1);

  if (input.status) {
    query = query.eq("status", input.status);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const userIds = [...new Set((data ?? []).map((r) => r.userId).filter(Boolean))];
  const driverIds = [...new Set((data ?? []).map((r) => r.driverId).filter(Boolean))];

  const [usersRes, driversRes] = await Promise.all([
    userIds.length > 0
      ? db.from("users").select("uid, displayName, email").in("uid", userIds)
      : Promise.resolve({ data: [] as { uid: string; displayName: string | null; email: string | null }[] }),
    driverIds.length > 0
      ? db.from("drivers").select("id, name, email").in("id", driverIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null; email: string | null }[] }),
  ]);

  const userMap = new Map((usersRes.data ?? []).map((u) => [u.uid, u.displayName || u.email || u.uid]));
  const driverMap = new Map((driversRes.data ?? []).map((d) => [d.id, d.name || d.email || d.id]));

  const rides = (data ?? []).map((r) => ({
    ...r,
    userName: userMap.get(r.userId) ?? r.userId,
    driverName: r.driverId ? (driverMap.get(r.driverId) ?? r.driverId) : null,
  }));

  return { rides, total: count ?? 0 };
}
