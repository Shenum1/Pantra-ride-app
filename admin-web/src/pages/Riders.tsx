import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { EmptyState } from '../components/ui/EmptyState';
import { TableSkeleton } from '../components/ui/Skeleton';

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

export default function Riders() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data, loading, error } = useTrpcQuery<UsersResponse>('admin.users');

  const riders = useMemo(() => {
    const rows = (data?.users ?? []).filter((u) => u.type === 'rider');
    const q = search.toLowerCase();
    return rows.filter(
      (u) => !q || (u.name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Riders</h1>
        <p className="mt-1 text-sm text-slate-500">Open a rider for wallet, saved places, and family contacts.</p>
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3 text-sm text-slate-500">
            {loading ? 'Loading…' : `${riders.length.toLocaleString()} riders`}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Rider</th>
                  <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Trips</th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <TableSkeleton rows={6} cols={3} />
                ) : riders.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-0">
                      <EmptyState title="No riders found" description="Try a different search." />
                    </td>
                  </tr>
                ) : (
                  riders.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/riders/${r.id}`)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{r.name || '—'}</p>
                        <p className="text-xs text-slate-400">{r.email || '—'}</p>
                      </td>
                      <td className="tnum px-5 py-3 text-right text-slate-700">{r.totalRides}</td>
                      <td className="px-5 py-3 text-slate-500">{new Date(r.joinDate).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
