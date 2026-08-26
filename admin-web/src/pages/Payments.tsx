import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { TableSkeleton } from '../components/ui/Skeleton';

interface TransactionRow {
  id: string;
  userId: string | null;
  userName: string | null;
  type: string;
  amount: number;
  description: string | null;
  status: 'completed' | 'pending' | 'failed';
  createdAt: string;
}

interface TransactionsResponse {
  transactions: TransactionRow[];
  total: number;
}

interface TipRow {
  id: string;
  rideId: string;
  riderName: string;
  driverName: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface TipsResponse {
  tips: TipRow[];
  total: number;
}

const STATUS_TONE: Record<string, 'success' | 'pending' | 'danger'> = {
  completed: 'success',
  successful: 'success',
  pending: 'pending',
  failed: 'danger',
  cancelled: 'danger',
  refunded: 'pending',
};

const LIMIT = 50;

export default function Payments() {
  const [tab, setTab] = useState<'transactions' | 'tips'>('transactions');
  const [offset, setOffset] = useState(0);

  const { data, loading, error } = useTrpcQuery<TransactionsResponse>(
    'admin.payments.transactions',
    { limit: LIMIT, offset },
    [offset, tab]
  );
  const { data: tipsData, loading: tipsLoading } = useTrpcQuery<TipsResponse>(
    'admin.payments.tips',
    { limit: LIMIT, offset },
    [offset, tab]
  );

  const total = tab === 'transactions' ? data?.total ?? 0 : tipsData?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + LIMIT, total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Payments</h1>
        <p className="mt-1 text-sm text-slate-500">Platform-wide wallet ledger — read-only.</p>
      </div>

      <div className="flex gap-2">
        {(['transactions', 'tips'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setOffset(0);
            }}
            className={`rounded-md px-4 py-2 text-sm font-semibold capitalize transition-colors
              ${tab === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{error}</div>
      ) : tab === 'transactions' ? (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">User</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Type</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Description</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Amount</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <TableSkeleton rows={8} cols={6} />
              ) : (data?.transactions ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState title="No transactions" />
                  </td>
                </tr>
              ) : (
                (data?.transactions ?? []).map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="max-w-[140px] truncate px-4 py-3 font-medium text-slate-900">{t.userName || '—'}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{t.type.replace(/_/g, ' ')}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-slate-500">{t.description || '—'}</td>
                    <td className={`tnum px-4 py-3 text-right font-medium ${t.amount < 0 ? 'text-danger' : 'text-slate-900'}`}>
                      {t.amount < 0 ? '−' : '+'}₦{Math.abs(t.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[t.status] ?? 'pending'}>{t.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Rider</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Driver</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Amount</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tipsLoading ? (
                <TableSkeleton rows={8} cols={5} />
              ) : (tipsData?.tips ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState title="No tips yet" />
                  </td>
                </tr>
              ) : (
                (tipsData?.tips ?? []).map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="max-w-[140px] truncate px-4 py-3 font-medium text-slate-900">{t.riderName}</td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-slate-600">{t.driverName}</td>
                    <td className="tnum px-4 py-3 text-right font-medium text-slate-900">₦{t.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[t.status] ?? 'pending'}>{t.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {total > LIMIT && (
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-slate-500">{from}–{to} of {total.toLocaleString()}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
              disabled={offset === 0}
              className="rounded-md border border-slate-200 bg-white p-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setOffset((o) => o + LIMIT)}
              disabled={to >= total}
              className="rounded-md border border-slate-200 bg-white p-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
