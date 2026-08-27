import { adminProcedure } from "../../../create-context";
import { calculateDriverPayout } from "@/lib/fare-calculator";

interface RecentActivityItem {
  id: string;
  type: 'user' | 'driver' | 'ride';
  title: string;
  subtitle: string;
  createdAt: string;
}

interface SettlementRow {
  fare: number | null;
  bookingFee: number | null;
  serviceFee: number | null;
  zoneFee: number | null;
  waitingCharge: number | null;
  priorityFee: number | null;
  platformCommissionAmount: number | null;
  driverEarningsAmount: number | null;
}

// Prefer the commission snapshotted per-ride at completion time (see
// FirebaseDriverService.updateRideStatus) so totals reflect the rate actually
// applied to each ride, not today's PLATFORM_COMMISSION_RATE retroactively
// applied to every ride ever completed. Only rows that predate the snapshot
// fall back to a live recalculation.
function sumSettlement(rows: SettlementRow[]) {
  let revenue = 0;
  let commission = 0;
  let driverEarnings = 0;
  for (const row of rows) {
    revenue += row.fare ?? 0;
    if (row.platformCommissionAmount != null && row.driverEarningsAmount != null) {
      commission += row.platformCommissionAmount;
      driverEarnings += row.driverEarningsAmount;
    } else {
      const payout = calculateDriverPayout(
        row.fare ?? 0,
        row.bookingFee ?? 0,
        row.serviceFee ?? 0,
        row.zoneFee ?? 0,
        row.waitingCharge ?? 0,
        row.priorityFee ?? 0
      );
      commission += payout.commission;
      driverEarnings += payout.netAmount;
    }
  }
  return { revenue, commission, driverEarnings };
}

export default adminProcedure.query(async ({ ctx }) => {
  const db = ctx.supabaseAdmin;

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const SETTLEMENT_COLUMNS =
    "fare, bookingFee, serviceFee, zoneFee, waitingCharge, priorityFee, platformCommissionAmount, driverEarningsAmount";

  const [
    totalUsersRes,
    totalRidersRes,
    totalDriversRes,
    activeDriversRes,
    ridesTodayRes,
    ridesInProgressRes,
    completedFaresRes,
    completedTodayFaresRes,
    recentUsersRes,
    recentDriversRes,
    recentRidesRes,
    tipsRes,
    manualReviewRes,
    pendingDocumentsRes,
    failedPayoutsRes,
    failedTransactionsRes,
    openTicketsRes,
  ] = await Promise.all([
    db.from("users").select("uid", { count: "exact", head: true }),
    db.from("users").select("uid", { count: "exact", head: true }).eq("role", "rider"),
    db.from("users").select("uid", { count: "exact", head: true }).eq("role", "driver"),
    db.from("drivers").select("id", { count: "exact", head: true }).eq("isOnline", true),
    db.from("rides").select("id", { count: "exact", head: true }).gte("createdAt", startOfToday.toISOString()),
    db.from("rides").select("id", { count: "exact", head: true }).eq("status", "in-progress"),
    db.from("rides").select(SETTLEMENT_COLUMNS).eq("status", "completed"),
    db
      .from("rides")
      .select(SETTLEMENT_COLUMNS)
      .eq("status", "completed")
      .gte("completedAt", startOfToday.toISOString()),
    db.from("users").select("uid, displayName, email, role, createdAt").order("createdAt", { ascending: false }).limit(5),
    db.from("drivers").select("id, name, email, createdAt").order("createdAt", { ascending: false }).limit(5),
    db.from("rides").select("id, status, fare, createdAt").order("createdAt", { ascending: false }).limit(5),
    db.from("tips").select("amount").eq("status", "successful"),
    db.from("drivers").select("id", { count: "exact", head: true }).eq("verificationStatus", "MANUAL_REVIEW"),
    db.from("driver_documents").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("driver_payouts").select("id", { count: "exact", head: true }).eq("status", "failed"),
    db.from("wallet_transactions").select("id", { count: "exact", head: true }).eq("status", "failed"),
    db.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  const { revenue: totalRevenue, commission: totalPlatformCommission, driverEarnings: totalDriverEarnings } =
    sumSettlement(completedFaresRes.data ?? []);
  const { revenue: todayRevenue, commission: todayPlatformCommission } = sumSettlement(completedTodayFaresRes.data ?? []);

  // Tips are 100% driver / 0% platform — a separate figure, deliberately
  // never added into totalRevenue/totalPlatformCommission/totalDriverEarnings
  // above (which are all fare/commission math and don't know tips exist).
  const totalTips = (tipsRes.data ?? []).reduce(
    (sum: number, row: { amount: number | null }) => sum + (row.amount ?? 0),
    0
  );

  const recentActivity: RecentActivityItem[] = [];

  for (const u of recentUsersRes.data ?? []) {
    recentActivity.push({
      id: `user-${u.uid}`,
      type: 'user',
      title: `New ${u.role ?? 'user'} registered`,
      subtitle: u.displayName || u.email || u.uid,
      createdAt: u.createdAt,
    });
  }

  for (const d of recentDriversRes.data ?? []) {
    recentActivity.push({
      id: `driver-${d.id}`,
      type: 'driver',
      title: 'New driver registered',
      subtitle: d.name || d.email || d.id,
      createdAt: d.createdAt,
    });
  }

  for (const r of recentRidesRes.data ?? []) {
    recentActivity.push({
      id: `ride-${r.id}`,
      type: 'ride',
      title: `Ride ${r.status}`,
      subtitle: `₦${(r.fare ?? 0).toLocaleString()}`,
      createdAt: r.createdAt,
    });
  }

  recentActivity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    totalUsers: totalUsersRes.count ?? 0,
    totalRiders: totalRidersRes.count ?? 0,
    totalDrivers: totalDriversRes.count ?? 0,
    activeDrivers: activeDriversRes.count ?? 0,
    ridesToday: ridesTodayRes.count ?? 0,
    ridesInProgress: ridesInProgressRes.count ?? 0,
    totalRevenue,
    totalPlatformCommission,
    totalDriverEarnings,
    totalTips,
    todayRevenue,
    todayPlatformCommission,
    needsAttention: {
      manualReview: manualReviewRes.count ?? 0,
      pendingDocuments: pendingDocumentsRes.count ?? 0,
      failedPayouts: failedPayoutsRes.count ?? 0,
      failedTransactions: failedTransactionsRes.count ?? 0,
      openTickets: openTicketsRes.count ?? 0,
    },
    recentActivity: recentActivity.slice(0, 5),
  };
});
