import { z } from "zod";
import { adminProcedure } from "../../../../create-context";

export default adminProcedure
  .input(
    z.object({
      status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    })
  )
  .query(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    let query = db
      .from("driver_payouts")
      .select("id, driverId, amount, bankAccountId, status, failureReason, requestedAt, completedAt", {
        count: "exact",
      })
      .order("requestedAt", { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);

    if (input.status) {
      query = query.eq("status", input.status);
    }

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    const driverIds = [...new Set((data ?? []).map((p) => p.driverId).filter(Boolean))];
    const bankAccountIds = [...new Set((data ?? []).map((p) => p.bankAccountId).filter(Boolean))];

    const [driversRes, bankRes] = await Promise.all([
      driverIds.length > 0
        ? db.from("drivers").select("id, name, email").in("id", driverIds)
        : Promise.resolve({ data: [] }),
      bankAccountIds.length > 0
        ? db
            .from("driver_bank_accounts")
            .select("id, bankName, accountNumber, accountName")
            .in("id", bankAccountIds)
        : Promise.resolve({ data: [] }),
    ]);

    const driverMap = new Map(
      (driversRes.data ?? []).map((d) => [d.id, { name: d.name, email: d.email }])
    );
    const bankMap = new Map(
      (bankRes.data ?? []).map((b) => [
        b.id,
        { bankName: b.bankName, accountNumber: b.accountNumber, accountName: b.accountName },
      ])
    );

    const payouts = (data ?? []).map((p) => ({
      ...p,
      driver: driverMap.get(p.driverId) ?? null,
      bankAccount: p.bankAccountId ? (bankMap.get(p.bankAccountId) ?? null) : null,
    }));

    return { payouts, total: count ?? 0 };
  });
