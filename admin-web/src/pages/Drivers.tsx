import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { TableSkeleton } from '../components/ui/Skeleton';
import { accountStatusTone, driverVerificationStatusTone } from '../lib/status';

interface UserRow {
  id: string;
  name: string | null;
  email: string | null;
  type: 'rider' | 'driver';
  status: 'active' | 'inactive';
  joinDate: string;
  totalRides: number;
}

interface UsersResponse {
  users: UserRow[];
}

interface DriverVerificationRow {
  id: string;
  verificationStatus: string;
}

interface DriversResponse {
  drivers: DriverVerificationRow[];
}

const VERIFICATION_FILTERS = ['all', 'VERIFIED', 'MANUAL_REVIEW', 'DOCUMENTS_SUBMITTED', 'REJECTED', 'PENDING'] as const;

export default function Drivers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [verificationFilter, setVerificationFilter] = useState<(typeof VERIFICATION_FILTERS)[number]>('all');

  const { data: usersData, loading: usersLoading, error: usersError } = useTrpcQuery<UsersResponse>('admin.users');
  const { data: verificationData, loading: verificationLoading } = useTrpcQuery<DriversResponse>(
    'admin.driverVerification.list',
    { status: 'all' }
  );

  const loading = usersLoading || verificationLoading;

  const verificationById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of verificationData?.drivers ?? []) map.set(d.id, d.verificationStatus);
    return map;
  }, [verificationData]);

  const drivers = useMemo(() => {
    const rows = (usersData?.users ?? []).filter((u) => u.type === 'driver');
    const q = search.toLowerCase();
    return rows.filter((u) => {
      const matchSearch = !q || (u.name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q);
      const verification = verificationById.get(u.id) ?? 'PENDING';
      const matchVerification = verificationFilter === 'all' || verification === verificationFilter;
      return matchSearch && matchVerification;
    });
  }, [usersData, verificationById, search, verificationFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Drivers</h1>
        <p className="mt-1 text-sm text-slate-500">Fleet roster — open a driver for full verification detail.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {VERIFICATION_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setVerificationFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors
                ${verificationFilter === f ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {usersError ? (
        <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{usersError}</div>
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3 text-sm text-slate-500">
            {loading ? 'Loading…' : `${drivers.length.toLocaleString()} drivers`}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Driver</th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Verification</th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Online</th>
                  <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Trips</th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <TableSkeleton rows={6} cols={5} />
                ) : drivers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <EmptyState title="No drivers found" description="Try a different search or filter." />
                    </td>
                  </tr>
                ) : (
                  drivers.map((d) => {
                    const verification = verificationById.get(d.id) ?? 'PENDING';
                    return (
                      <tr
                        key={d.id}
                        onClick={() => navigate(`/drivers/${d.id}`)}
                        className="cursor-pointer transition-colors hover:bg-slate-50"
                      >
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-900">{d.name || '—'}</p>
                          <p className="text-xs text-slate-400">{d.email || '—'}</p>
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={driverVerificationStatusTone[verification] ?? 'neutral'}>
                            {verification.replace(/_/g, ' ').toLowerCase()}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={accountStatusTone[d.status]}>{d.status}</Badge>
                        </td>
                        <td className="tnum px-5 py-3 text-right text-slate-700">{d.totalRides}</td>
                        <td className="px-5 py-3 text-slate-500">{new Date(d.joinDate).toLocaleDateString()}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
