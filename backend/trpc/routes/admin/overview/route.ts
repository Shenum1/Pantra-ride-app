import { adminProcedure } from "../../../create-context";

interface RecentActivityItem {
  id: string;
  type: 'user' | 'driver' | 'ride';
  title: string;
  subtitle: string;
  createdAt: string;
}

export default adminProcedure.query(async ({ ctx }) => {
  const db = ctx.supabaseAdmin;

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [
    totalUsersRes,
    totalRidersRes,
    totalDriversRes,
    activeDriversRes,
    ridesTodayRes,
    completedFaresRes,
    recentUsersRes,
    recentDriversRes,
    recentRidesRes,
  ] = await Promise.all([
    db.from("users").select("uid", { count: "exact", head: true }),
    db.from("users").select("uid", { count: "exact", head: true }).eq("role", "rider"),
    db.from("users").select("uid", { count: "exact", head: true }).eq("role", "driver"),
    db.from("drivers").select("id", { count: "exact", head: true }).eq("isOnline", true),
    db.from("rides").select("id", { count: "exact", head: true }).gte("createdAt", startOfToday.toISOString()),
    db.from("rides").select("fare").eq("status", "completed"),
    db.from("users").select("uid, displayName, email, role, createdAt").order("createdAt", { ascending: false }).limit(5),
    db.from("drivers").select("id, name, email, createdAt").order("createdAt", { ascending: false }).limit(5),
    db.from("rides").select("id, status, fare, createdAt").order("createdAt", { ascending: false }).limit(5),
  ]);

  const totalRevenue = (completedFaresRes.data ?? []).reduce(
    (sum: number, row: { fare: number | null }) => sum + (row.fare ?? 0),
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
    totalRevenue,
    recentActivity: recentActivity.slice(0, 5),
  };
});
