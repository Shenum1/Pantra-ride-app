import { useState } from 'react';
import { trpcMutate } from '../lib/api';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { StatusLabel } from '../components/ui/StatusLabel';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterTabs } from '../components/ui/FilterTabs';
import { Table, type TableColumn } from '../components/ui/Table';
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
  bankAccount: { bankName: string; accountNumberLast4: string; accountName: string } | null;
}

interface PayoutsResponse {
  payouts: PayoutRow[];
  total: number;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];
const LIMIT = 50;

export default function Payouts() {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [offset, setOffset] = useState(0);
  const [updating, setUpdating] = useState<string | null>(null);
  const [failModal, setFailModal] = useState<{ id: string } | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<string | null>(null);

  const { data, loading, error, setData } = useTrpcQuery<PayoutsResponse>(
    'admin.payouts.list',
    { status: statusFilter || undefined, limit: LIMIT, offset },
    [statusFilter, offset]
  );

  const payouts = data?.payouts ?? [];
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + LIMIT, total);

  const revealAccountNumber = async (payoutId: string, bankAccountId: string) => {
    setRevealing(payoutId);
    try {
      const result = await trpcMutate<{ accountNumber: string }>('admin.payouts.revealBankAccount', { bankAccountId });
      setRevealed((prev) => ({ ...prev, [payoutId]: result.accountNumber }));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setRevealing(null);
    }
  };

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

  const columns: TableColumn<PayoutRow>[] = [
    {
      key: 'driver',
      header: 'Driver',
      render: (p) => (
        <>
          <p className="font-medium text-slate-900">{p.driver?.name ?? '—'}</p>
          <p className="text-xs text-slate-400">{p.driver?.email}</p>
        </>
      ),
    },
    {
      key: 'bank',
      header: 'Bank account',
      render: (p) =>
        p.bankAccount ? (
          <>
            <p className="text-slate-700">{p.bankAccount.bankName}</p>
            <p className="text-xs text-slate-400">
              {revealed[p.id] ? revealed[p.id] : `••••${p.bankAccount.accountNumberLast4}`} · {p.bankAccount.accountName}
            </p>
            {!revealed[p.id] && (
              <button
                type="button"
                className="mt-0.5 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                disabled={revealing === p.id}
                onClick={() => revealAccountNumber(p.id, p.bankAccountId)}
              >
                {revealing === p.id ? 'Revealing…' : 'Reveal'}
              </button>
            )}
          </>
        ) : (
          <span className="italic text-slate-300">—</span>
        ),
    },
    { key: 'amount', header: 'Amount', align: 'right', render: (p) => <span className="tnum font-semibold text-slate-900">₦{p.amount.toLocaleString()}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <>
          <StatusLabel tone={payoutStatusTone[p.status]}>{p.status}</StatusLabel>
          {p.failureReason && <p className="mt-0.5 text-xs text-danger">{p.failureReason}</p>}
        </>
      ),
    },
    { key: 'requested', header: 'Requested', render: (p) => <span className="whitespace-nowrap text-slate-500">{new Date(p.requestedAt).toLocaleDateString()}</span> },
    {
      key: 'action',
      header: 'Action',
      render: (p) => (
        <>
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
        </>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Payouts" description="Driver withdrawal requests." />

      <FilterTabs options={STATUS_OPTIONS} value={statusFilter} onChange={(v) => { setStatusFilter(v); setOffset(0); }} />

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{error}</div>
      ) : (
        <Table
          columns={columns}
          rows={payouts}
          rowKey={(p) => p.id}
          loading={loading}
          countLabel={`${total.toLocaleString()} payout request${total !== 1 ? 's' : ''}`}
          emptyTitle="No payout requests"
          emptyDescription="Try a different status filter."
          pagination={{ from, to, total, limit: LIMIT, onPrev: () => setOffset((o) => Math.max(0, o - LIMIT)), onNext: () => setOffset((o) => o + LIMIT) }}
        />
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
