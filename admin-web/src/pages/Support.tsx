import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { TableSkeleton } from '../components/ui/Skeleton';
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

const STATUS_FILTERS = ['', 'open', 'in_progress', 'resolved', 'closed'] as const;

export default function Support() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('open');

  const { data, loading, error } = useTrpcQuery<TicketsResponse>(
    'admin.support.list',
    { status: statusFilter || undefined, limit: 50, offset: 0 },
    [statusFilter]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Support</h1>
        <p className="mt-1 text-sm text-slate-500">Tickets filed by riders and drivers.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors
              ${statusFilter === s ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            {s === '' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Subject</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Filed by</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Category</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Priority</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <TableSkeleton rows={6} cols={6} />
              ) : (data?.tickets ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState title="No tickets" description="Nothing matches this filter right now." />
                  </td>
                </tr>
              ) : (
                (data?.tickets ?? []).map((t) => (
                  <tr key={t.id} onClick={() => navigate(`/support/${t.id}`)} className="cursor-pointer hover:bg-slate-50">
                    <td className="max-w-[220px] truncate px-4 py-3 font-medium text-slate-900">{t.subject}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {t.filedByName || '—'} <span className="text-xs capitalize text-slate-400">({t.filedByRole})</span>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-500">{t.category.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">
                      <Badge tone={ticketPriorityTone[t.priority]}>{t.priority}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={ticketStatusTone[t.status]}>{t.status.replace(/_/g, ' ')}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(t.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
