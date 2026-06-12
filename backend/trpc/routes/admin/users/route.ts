import { adminProcedure } from "../../../create-context";

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  type: 'rider' | 'driver';
  status: 'active' | 'inactive';
  joinDate: string;
  totalRides: number;
}

export default adminProcedure.query(async ({ ctx }) => {
  const db = ctx.supabaseAdmin;

  const [usersRes, driversRes, completedRidesRes] = await Promise.all([
    db.from("users").select("uid, displayName, email, role, createdAt"),
    db.from("drivers").select("id, name, email, totalRides, isOnline, createdAt"),
    db.from("rides").select("userId").eq("status", "completed"),
  ]);

  const riderRideCounts = new Map<string, number>();
  for (const row of completedRidesRes.data ?? []) {
    if (!row.userId) continue;
    riderRideCounts.set(row.userId, (riderRideCounts.get(row.userId) ?? 0) + 1);
  }

  const users: AdminUserRow[] = [];

  for (const u of usersRes.data ?? []) {
    if (u.role !== 'rider') continue;
    users.push({
      id: u.uid,
      name: u.displayName || u.email || u.uid,
      email: u.email ?? '',
      type: 'rider',
      status: 'active',
      joinDate: u.createdAt,
      totalRides: riderRideCounts.get(u.uid) ?? 0,
    });
  }

  for (const d of driversRes.data ?? []) {
    users.push({
      id: d.id,
      name: d.name || d.email || d.id,
      email: d.email ?? '',
      type: 'driver',
      status: d.isOnline ? 'active' : 'inactive',
      joinDate: d.createdAt,
      totalRides: d.totalRides ?? 0,
    });
  }

  users.sort((a, b) => new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime());

  const totalRiders = (usersRes.data ?? []).filter((u) => u.role === 'rider').length;
  const activeDrivers = (driversRes.data ?? []).filter((d) => d.isOnline).length;

  return {
    users,
    stats: {
      totalUsers: (usersRes.data ?? []).length + (driversRes.data ?? []).length,
      activeDrivers,
      totalRiders,
    },
  };
});
