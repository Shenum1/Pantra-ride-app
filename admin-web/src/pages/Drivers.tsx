import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { StatusLabel } from '../components/ui/StatusLabel';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterTabs } from '../components/ui/FilterTabs';
import { Table, type TableColumn } from '../components/ui/Table';
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

interface DriverListRow extends UserRow {
  verification: string;
}

type VerificationFilter = 'all' | 'VERIFIED' | 'MANUAL_REVIEW' | 'DOCUMENTS_SUBMITTED' | 'REJECTED' | 'PENDING';

const VERIFICATION_FILTERS: { value: VerificationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'MANUAL_REVIEW', label: 'Manual review' },
  { value: 'DOCUMENTS_SUBMITTED', label: 'Submitted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'PENDING', label: 'Pending' },
];

export default function Drivers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>('all');

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

  const drivers: DriverListRow[] = useMemo(() => {
    const rows = (usersData?.users ?? []).filter((u) => u.type === 'driver');
    const q = search.toLowerCase();
    return rows
      .map((u) => ({ ...u, verification: verificationById.get(u.id) ?? 'PENDING' }))
      .filter((u) => {
        const matchSearch = !q || (u.name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q);
        const matchVerification = verificationFilter === 'all' || u.verification === verificationFilter;
        return matchSearch && matchVerification;
      });
  }, [usersData, verificationById, search, verificationFilter]);

  const columns: TableColumn<DriverListRow>[] = [
    {
      key: 'driver',
      header: 'Driver',
      render: (d) => (
        <>
          <p className="font-medium text-slate-900">{d.name || '—'}</p>
          <p className="text-xs text-slate-400">{d.email || '—'}</p>
        </>
      ),
    },
    {
      key: 'verification',
      header: 'Verification',
      render: (d) => (
        <StatusLabel tone={driverVerificationStatusTone[d.verification] ?? 'neutral'}>
          {d.verification.replace(/_/g, ' ').toLowerCase()}
        </StatusLabel>
      ),
    },
    { key: 'online', header: 'Online', render: (d) => <StatusLabel tone={accountStatusTone[d.status]}>{d.status}</StatusLabel> },
    { key: 'trips', header: 'Trips', align: 'right', render: (d) => <span className="tnum text-slate-700">{d.totalRides}</span> },
    { key: 'joined', header: 'Joined', render: (d) => <span className="text-slate-500">{new Date(d.joinDate).toLocaleDateString()}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Drivers" description="Fleet roster — open a driver for full verification detail." />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs options={VERIFICATION_FILTERS} value={verificationFilter} onChange={setVerificationFilter} />
        <div className="relative w-full max-w-xs sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {usersError ? (
        <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{usersError}</div>
      ) : (
        <Table
          columns={columns}
          rows={drivers}
          rowKey={(d) => d.id}
          loading={loading}
          countLabel={`${drivers.length.toLocaleString()} drivers`}
          emptyTitle="No drivers found"
          emptyDescription="Try a different search or filter."
          onRowClick={(d) => navigate(`/drivers/${d.id}`)}
        />
      )}
    </div>
  );
}
