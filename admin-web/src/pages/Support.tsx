import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { StatusLabel } from '../components/ui/StatusLabel';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterTabs } from '../components/ui/FilterTabs';
import { Table, type TableColumn } from '../components/ui/Table';
import { ticketStatusTone, ticketPriorityTone } from '../lib/status';

interface TicketRow {
  id: string;
  filedByRole: 'rider' | 'driver';
  filedByName: string | null;
  subject: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: string;
  updatedAt: string;
}

interface TicketsResponse {
  tickets: TicketRow[];
  total: number;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export default function Support() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('open');

  const { data, loading, error } = useTrpcQuery<TicketsResponse>(
    'admin.support.list',
    { status: statusFilter || undefined, limit: 50, offset: 0 },
    [statusFilter]
  );

  const columns: TableColumn<TicketRow>[] = [
    { key: 'subject', header: 'Subject', render: (t) => <span className="max-w-[220px] truncate font-medium text-slate-900">{t.subject}</span> },
    {
      key: 'filedBy',
      header: 'Filed by',
      render: (t) => (
        <span className="text-slate-600">
          {t.filedByName || '—'} <span className="text-xs capitalize text-slate-400">({t.filedByRole})</span>
        </span>
      ),
    },
    { key: 'category', header: 'Category', render: (t) => <span className="capitalize text-slate-500">{t.category.replace(/_/g, ' ')}</span> },
    { key: 'priority', header: 'Priority', render: (t) => <StatusLabel tone={ticketPriorityTone[t.priority]}>{t.priority}</StatusLabel> },
    { key: 'status', header: 'Status', render: (t) => <StatusLabel tone={ticketStatusTone[t.status]}>{t.status.replace(/_/g, ' ')}</StatusLabel> },
    { key: 'updated', header: 'Updated', render: (t) => <span className="whitespace-nowrap text-slate-500">{new Date(t.updatedAt).toLocaleDateString()}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Support" description="Tickets filed by riders and drivers." />

      <FilterTabs options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{error}</div>
      ) : (
        <Table
          columns={columns}
          rows={data?.tickets ?? []}
          rowKey={(t) => t.id}
          loading={loading}
          emptyTitle="No tickets"
          emptyDescription="Nothing matches this filter right now."
          onRowClick={(t) => navigate(`/support/${t.id}`)}
        />
      )}
    </div>
  );
}
