import { Link } from 'react-router-dom';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { PageHeader } from '../components/ui/PageHeader';

interface OverviewData {
  totalUsers: number;
  totalRiders: number;
  totalDrivers: number;
  activeDrivers: number;
  ridesToday: number;
  ridesInProgress: number;
  totalRevenue: number;
  totalPlatformCommission: number;
  totalDriverEarnings: number;
  totalTips: number;
  todayRevenue: number;
  todayPlatformCommission: number;
  needsAttention: {
    manualReview: number;
    pendingDocuments: number;
    failedPayouts: number;
    failedTransactions: number;
    openTickets: number;
  };
  recentActivity: { id: string; type: 'user' | 'driver' | 'ride'; title: string; subtitle: string; createdAt: string }[];
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

function AttentionRow({ to, count, label, tone }: { to: string; count: number; label: string; tone: 'danger' | 'warning' }) {
  return (
    <Link
      to={to}
      className={`flex items-center justify-between gap-4 border-l-2 py-3 pl-4 pr-3 transition-colors hover:bg-slate-50 ${
        tone === 'danger' ? 'border-danger' : 'border-warning'
      }`}
    >
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className={`tnum text-lg font-semibold ${tone === 'danger' ? 'text-danger' : 'text-warning'}`}>{count}</span>
    </Link>
  );
}

function StatItem({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <p className="tnum text-xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}

export default function Overview() {
  const { data, loading, error } = useTrpcQuery<OverviewData>('admin.overview');

  if (loading) {
    return <p className="text-sm text-slate-400">Loading overview…</p>;
  }

  if (error || !data) {
    return <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{error}</div>;
  }

  type AttentionTone = 'danger' | 'warning';
  const ALL_ATTENTION: { to: string; count: number; label: string; tone: AttentionTone }[] = [
    { to: '/payouts', count: data.needsAttention.failedPayouts, label: 'Payouts failed', tone: 'danger' },
    { to: '/payments', count: data.needsAttention.failedTransactions, label: 'Wallet transactions failed', tone: 'danger' },
    { to: '/verification', count: data.needsAttention.manualReview, label: 'Drivers in manual review', tone: 'warning' },
    { to: '/verification', count: data.needsAttention.pendingDocuments, label: 'Documents awaiting review', tone: 'warning' },
    { to: '/support', count: data.needsAttention.openTickets, label: 'Support tickets open', tone: 'warning' },
  ];
  const attentionItems = ALL_ATTENTION.filter((i) => i.count > 0).sort((a, b) =>
    a.tone === b.tone ? b.count - a.count : a.tone === 'danger' ? -1 : 1
  );

  return (
    <div className="space-y-8">
      <PageHeader title="Overview" />

      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Needs attention</h2>
        {attentionItems.length === 0 ? (
          <p className="border-l-2 border-slate-200 py-3 pl-4 text-sm text-slate-500">
            Nothing needs a decision right now.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
            {attentionItems.map((item) => (
              <AttentionRow key={item.label} {...item} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Right now</h2>
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          <StatItem value={data.ridesInProgress} label="Trips in progress" />
          <StatItem value={data.ridesToday} label="Trips today" />
          <StatItem value={`${data.activeDrivers} / ${data.totalDrivers}`} label="Drivers online" />
          <StatItem value={`₦${data.todayRevenue.toLocaleString()}`} label="Revenue today" />
          <StatItem value={`₦${data.todayPlatformCommission.toLocaleString()}`} label="Commission today" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">All time</h2>
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          <StatItem value={data.totalRiders.toLocaleString()} label="Total riders" />
          <StatItem value={data.totalDrivers.toLocaleString()} label="Total drivers" />
          <StatItem value={`₦${data.totalRevenue.toLocaleString()}`} label="Total revenue" />
          <StatItem value={`₦${data.totalDriverEarnings.toLocaleString()}`} label="Driver earnings" />
          <StatItem value={`₦${data.totalPlatformCommission.toLocaleString()}`} label="Platform commission" />
          <StatItem value={`₦${data.totalTips.toLocaleString()}`} label="Tips (driver-only)" />
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
