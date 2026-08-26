import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { trpcMutate } from '../lib/api';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { EmptyState } from '../components/ui/EmptyState';
import { TableSkeleton } from '../components/ui/Skeleton';
import { payoutStatusTone } from '../lib/status';

interface PayoutRow {
  id: string;
  driverId: string;
  amount: number;
  bankAccountId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  failureReason?: string;
  requestedAt: string;
  completedAt?: string;
  driver: { name: string; email: string } | null;
  bankAccount: { bankName: string; accountNumber: string; accountName: string } | null;
}

interface PayoutsResponse {
  payouts: PayoutRow[];
  total: number;
}

const STATUSES = ['', 'pending', 'processing', 'completed', 'failed'] as const;
const LIMIT = 50;

export default function Payouts() {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]>('pending');
  const [offset, setOffset] = useState(0);
  const [updating, setUpdating] = useState<string | null>(null);
  const [failModal, setFailModal] = useState<{ id: string } | null>(null);

  const { data, loading, error, setData } = useTrpcQuery<PayoutsResponse>(
    'admin.payouts.list',
    { status: statusFilter || undefined, limit: LIMIT, offset },
    [statusFilter, offset]
  );

  const payouts = data?.payouts ?? [];
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + LIMIT, total);

  const updateStatus = async (id: string, status: 'processing' | 'completed' | 'failed', failureReason?: string) => {
    setUpdating(id);
    try {
      await trpcMutate('admin.payouts.updateStatus', { id, status, failureReason });
      setData((prev) =>
        prev ? { ...prev, payouts: prev.payouts.map((p) => (p.id === id ? { ...p, status, failureReason } : p)) } : prev
      );
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setUpdating(null);
      setFailModal(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Payouts</h1>
        <p className="mt-1 text-sm text-slate-500">Driver withdrawal requests.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s);
              setOffset(0);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors
              ${statusFilter === s ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            {s === '' ? 'All' : s}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3 text-sm text-slate-500">
            {loading ? 'Loading…' : `${total.toLocaleString()} payout request${total !== 1 ? 's' : ''}`}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Driver</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Bank account</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Amount</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Requested</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <TableSkeleton rows={8} cols={6} />
                ) : payouts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <EmptyState title="No payout requests" description="Try a different status filter." />
                    </td>
                  </tr>
                ) : (
                  payouts.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{p.driver?.name ?? '—'}</p>
                        <p className="text-xs text-slate-400">{p.driver?.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        {p.bankAccount ? (
                          <>
                            <p className="text-slate-700">{p.bankAccount.bankName}</p>
                            <p className="text-xs text-slate-400">{p.bankAccount.accountNumber} · {p.bankAccount.accountName}</p>
                          </>
                        ) : (
                          <span className="italic text-slate-300">—</span>
                        )}
                      </td>
                      <td className="tnum px-4 py-3 text-right font-semibold text-slate-900">₦{p.amount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Badge tone={payoutStatusTone[p.status]}>{p.status}</Badge>
                        {p.failureReason && <p className="mt-0.5 text-xs text-danger">{p.failureReason}</p>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(p.requestedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {p.status === 'pending' && (
                          <Button variant="primary" size="sm" disabled={updating === p.id} onClick={() => updateStatus(p.id, 'processing')}>
                            Mark processing
                          </Button>
                        )}
                        {p.status === 'processing' && (
                          <div className="flex gap-2">
                            <Button variant="success" size="sm" disabled={updating === p.id} onClick={() => updateStatus(p.id, 'completed')}>
                              Paid
                            </Button>
                            <Button variant="danger" size="sm" disabled={updating === p.id} onClick={() => setFailModal({ id: p.id })}>
                              Failed
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {total > LIMIT && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5">
              <span className="text-sm text-slate-500">{from}–{to} of {total.toLocaleString()}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
                  disabled={offset === 0}
                  className="rounded-md border border-slate-200 p-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setOffset((o) => o + LIMIT)}
                  disabled={to >= total}
                  className="rounded-md border border-slate-200 p-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {failModal && (
        <ConfirmModal
          title="Mark as failed"
          reasonLabel="Failure reason"
          reasonPlaceholder="Enter failure reason (optional)"
          confirmLabel="Confirm failed"
          confirmVariant="danger"
          processing={updating === failModal.id}
          onCancel={() => setFailModal(null)}
          onConfirm={(reason) => updateStatus(failModal.id, 'failed', reason)}
        />
      )}
    </div>
  );
}
