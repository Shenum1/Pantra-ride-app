import { z } from "zod";
import { adminProcedure } from "../../../../create-context";

export default adminProcedure
  .input(
    z.object({
      status: z.enum(["requested", "processing", "completed", "failed", "cancelled", "reversed", "unknown"]).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    })
  )
  .query(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    let query = db
      .from("refund_intents")
      .select(
        "id, originalPaymentType, paymentIntentId, rideId, userId, provider, refundReference, providerRefundId, originalAmount, amount, currency, reason, refundType, status, requestedBy, driverImpactAmount, requiresDriverAdjustmentReview, failureReason, createdAt, updatedAt",
        { count: "exact" }
      )
      .order("createdAt", { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);

    if (input.status) query = query.eq("status", input.status);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    const userIds = [...new Set((data ?? []).map((r) => r.userId).filter(Boolean))];
    const adminIds = [...new Set((data ?? []).map((r) => r.requestedBy).filter(Boolean))];
    const refundIds = (data ?? []).map((r) => r.id);

    const [usersRes, adminsRes, reconciliationRes] = await Promise.all([
      userIds.length > 0
        ? db.from("users").select("uid, name, email").in("uid", userIds)
        : Promise.resolve({ data: [] as { uid: string; name: string; email: string }[] }),
      adminIds.length > 0
        ? db.from("users").select("uid, name, email").in("uid", adminIds)
        : Promise.resolve({ data: [] as { uid: string; name: string; email: string }[] }),
      refundIds.length > 0
        ? db.from("payment_reconciliation_records").select("refundId").in("refundId", refundIds).eq("reconciliationStatus", "open")
        : Promise.resolve({ data: [] as { refundId: string }[] }),
    ]);

    const userMap = new Map((usersRes.data ?? []).map((u) => [u.uid, { name: u.name, email: u.email }]));
    const adminMap = new Map((adminsRes.data ?? []).map((u) => [u.uid, { name: u.name, email: u.email }]));
    const openReconciliationRefundIds = new Set((reconciliationRes.data ?? []).map((r) => r.refundId));

    const refunds = (data ?? []).map((r) => ({
      ...r,
      user: userMap.get(r.userId) ?? null,
      requestedByAdmin: adminMap.get(r.requestedBy) ?? null,
      hasOpenReconciliation: openReconciliationRefundIds.has(r.id),
    }));

    return { refunds, total: count ?? 0 };
  });
