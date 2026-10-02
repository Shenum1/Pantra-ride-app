import { z } from "zod";
import { adminProcedure } from "../../../../create-context";
import { cashCommissionStatusFrom } from "../../../../../lib/cash-commission";

// Drivers' cash-commission positions for the admin "Cash commission" page:
// what each owes, whether they're over the limit (cash rides paused), and
// their recent commission ledger entries.
export default adminProcedure
  .input(z.object({ owingOnly: z.boolean().default(true) }))
  .query(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    const [summaryRes, limitRes] = await Promise.all([
      db.rpc("get_drivers_commission_summary"),
      db.rpc("get_driver_cash_debt_limit"),
    ]);
    if (summaryRes.error) throw new Error(summaryRes.error.message);
    if (limitRes.error) throw new Error(limitRes.error.message);
    const limit = Number(limitRes.data ?? 0);

    const rows = ((summaryRes.data ?? []) as {
      driverId: string;
      netBalance: number;
      totalCommission: number;
      totalSettled: number;
      lastSettlementAt: string | null;
    }[])
      .map((r) => ({
        driverId: r.driverId,
        totalCommission: Number(r.totalCommission),
        totalSettled: Number(r.totalSettled),
        lastSettlementAt: r.lastSettlementAt,
        ...cashCommissionStatusFrom(Number(r.netBalance), limit),
      }))
      .filter((r) => !input.owingOnly || r.amountOwed > 0)
      .sort((a, b) => b.amountOwed - a.amountOwed);

    const driverIds = rows.map((r) => r.driverId);
    const [driversRes, ledgerRes] = await Promise.all([
      driverIds.length > 0
        ? db.from("drivers").select("id, name, email, phone").in("id", driverIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null; email: string | null; phone: string | null }[], error: null }),
      driverIds.length > 0
        ? db
            .from("driver_commission_ledger")
            .select("id, driverId, rideId, type, amount, reason, reference, createdBy, createdAt")
            .in("driverId", driverIds)
            .order("createdAt", { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);
    if (driversRes.error) throw new Error(driversRes.error.message);
    if (ledgerRes.error) throw new Error(ledgerRes.error.message);

    const driverMap = new Map((driversRes.data ?? []).map((d) => [d.id, d]));
    const ledgerByDriver = new Map<string, any[]>();
    for (const entry of ledgerRes.data ?? []) {
      const list = ledgerByDriver.get(entry.driverId) ?? [];
      if (list.length < 10) list.push(entry);
      ledgerByDriver.set(entry.driverId, list);
    }

    return {
      limit,
      drivers: rows.map((r) => ({
        ...r,
        driver: driverMap.get(r.driverId) ?? null,
        recentEntries: ledgerByDriver.get(r.driverId) ?? [],
      })),
    };
  });
