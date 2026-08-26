import { Link } from 'react-router-dom';
import { useTrpcQuery } from '../hooks/useTrpcQuery';

interface OverviewData {
  totalUsers: number;
  totalRiders: number;
  totalDrivers: number;
  activeDrivers: number;
  ridesToday: number;
  totalRevenue: number;
  totalPlatformCommission: number;
  totalDriverEarnings: number;
  totalTips: number;
  recentActivity: { id: string; type: 'user' | 'driver' | 'ride'; title: string; subtitle: string; createdAt: string }[];
}

interface CountResponse {
  drivers?: unknown[];
  payouts?: unknown[];
  total?: number;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const ACTIVITY_DOT: Record<string, string> = {
  user: 'bg-slate-300',
  driver: 'bg-pending',
  ride: 'bg-primary',
};

function AttentionTile({ to, count, label }: { to: string; count: number | null; label: string }) {
  const hot = (count ?? 0) > 0;
  return (
    <Link
      to={to}
      className={`flex-1 min-w-[160px] rounded-md border p-4 transition-colors ${
        hot ? 'border-warning/25 bg-warning-tint hover:bg-warning-tint/70' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <p className={`tnum text-2xl font-bold tracking-tight ${hot ? 'text-warning' : 'text-slate-900'}`}>
        {count ?? '—'}
      </p>
      <p className="mt-0.5 text-sm text-slate-500">{label}</p>
    </Link>
  );
}

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex-1 min-w-[140px] rounded-md border border-slate-200 bg-white p-4">
      <p className="tnum text-xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-0.5 text-sm text-slate-500">{label}</p>
    </div>
  );
}

export default function Overview() {
  const { data, loading, error } = useTrpcQuery<OverviewData>('admin.overview');
  const { data: manualReview } = useTrpcQuery<CountResponse>('admin.driverVerification.list', { status: 'MANUAL_REVIEW' });
  const { data: pendingPayouts } = useTrpcQuery<CountResponse>('admin.payouts.list', { status: 'pending', limit: 1 });
  const { data: failedPayouts } = useTrpcQuery<CountResponse>('admin.payouts.list', { status: 'failed', limit: 1 });

  if (loading) {
    return <p className="text-sm text-slate-400">Loading overview…</p>;
  }

  if (error || !data) {
    return <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{error}</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Overview</h1>

      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Needs attention</h2>
        <div className="flex flex-wrap gap-3">
          <AttentionTile to="/verification" count={manualReview?.drivers?.length ?? null} label="Drivers in manual review" />
          <AttentionTile to="/payouts" count={pendingPayouts?.total ?? null} label="Payouts pending" />
          <AttentionTile to="/payouts" count={failedPayouts?.total ?? null} label="Payouts failed" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Performance</h2>
        <div className="flex flex-wrap gap-3">
          <StatTile value={data.ridesToday} label="Trips today" />
          <StatTile value={`${data.activeDrivers} / ${data.totalDrivers}`} label="Drivers online" />
          <StatTile value={data.totalRiders.toLocaleString()} label="Total riders" />
          <StatTile value={`₦${data.totalRevenue.toLocaleString()}`} label="Total revenue" />
          <StatTile value={`₦${data.totalDriverEarnings.toLocaleString()}`} label="Driver earnings" />
          <StatTile value={`₦${data.totalPlatformCommission.toLocaleString()}`} label="Platform commission" />
          <StatTile value={`₦${data.totalTips.toLocaleString()}`} label="Tips (driver-only)" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Recent activity</h2>
        <div className="rounded-md border border-slate-200 bg-white">
          {data.recentActivity.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No recent activity</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentActivity.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${ACTIVITY_DOT[item.type] ?? 'bg-slate-300'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{item.title}</p>
                    <p className="truncate text-xs text-slate-400">{item.subtitle}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-slate-400">{timeAgo(item.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
