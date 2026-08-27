import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { PageHeader } from '../components/ui/PageHeader';
import { Table, type TableColumn } from '../components/ui/Table';

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

  const columns: TableColumn<UserRow>[] = [
    {
      key: 'rider',
      header: 'Rider',
      render: (r) => (
        <>
          <p className="font-medium text-slate-900">{r.name || '—'}</p>
          <p className="text-xs text-slate-400">{r.email || '—'}</p>
        </>
      ),
    },
    { key: 'trips', header: 'Trips', align: 'right', render: (r) => <span className="tnum text-slate-700">{r.totalRides}</span> },
    { key: 'joined', header: 'Joined', render: (r) => <span className="text-slate-500">{new Date(r.joinDate).toLocaleDateString()}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Riders" description="Open a rider for wallet, saved places, and family contacts." />

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
        <Table
          columns={columns}
          rows={riders}
          rowKey={(r) => r.id}
          loading={loading}
          countLabel={`${riders.length.toLocaleString()} riders`}
          emptyTitle="No riders found"
          emptyDescription="Try a different search."
          onRowClick={(r) => navigate(`/riders/${r.id}`)}
        />
      )}
    </div>
  );
}
