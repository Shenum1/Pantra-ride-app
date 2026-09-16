import { useState } from 'react';
import { trpcMutate } from '../lib/api';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { StatusLabel } from '../components/ui/StatusLabel';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterTabs } from '../components/ui/FilterTabs';
import { Table, type TableColumn } from '../components/ui/Table';
import { payoutStatusTone } from '../lib/status';

type PayoutStatus = 'pending' | 'processing' | 'manual_review' | 'completed' | 'failed' | 'reversed';

interface ManualAction {
  id: string;
  action: 'moved_to_manual_review' | 'manual_completed' | 'manual_failed' | 'retry_initiated';
  adminUserId: string | null;
  externalReference?: string | null;
  notes?: string | null;
  createdAt: string;
}

interface PayoutRow {
  id: string;
  driverId: string;
  amount: number;
  bankAccountId: string;
  status: PayoutStatus;
  payoutMethod: 'automatic' | 'manual';
  provider: 'paystack' | 'flutterwave' | null;
  providerTransferReference: string | null;
  providerTransferCode: string | null;
  failureReason?: string;
  requestedAt: string;
  processingStartedAt?: string | null;
  completedAt?: string;
  driver: { name: string; email: string } | null;
  bankAccount: { bankName: string; accountNumberLast4: string; accountName: string } | null;
  manualActions: ManualAction[];
  hasOpenReconciliation: boolean;
}

interface PayoutsResponse {
  payouts: PayoutRow[];
  total: number;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'manual_review', label: 'Manual review' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'reversed', label: 'Reversed' },
];
const LIMIT = 50;

export default function Payouts() {
  const [statusFilter, setStatusFilter] = useState('manual_review');
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [manualReviewModal, setManualReviewModal] = useState<{ id: string } | null>(null);
  const [failModal, setFailModal] = useState<{ id: string } | null>(null);
  const [completeModal, setCompleteModal] = useState<{ id: string } | null>(null);
  const [completeForm, setCompleteForm] = useState({ externalReference: '', notes: '' });
  const [checkResult, setCheckResult] = useState<Record<string, string>>({});

  const { data, loading, error, refetch } = useTrpcQuery<PayoutsResponse>(
    'admin.payouts.list',
    { status: statusFilter || undefined, limit: LIMIT, offset },
    [statusFilter, offset]
  );

  const payouts = data?.payouts ?? [];
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + LIMIT, total);

  const runAction = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
      await refetch();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const revealAccountNumber = (payoutId: string, bankAccountId: string) =>
    runAction(payoutId, async () => {
      const result = await trpcMutate<{ accountNumber: string }>('admin.payouts.revealBankAccount', { bankAccountId });
      setRevealed((prev) => ({ ...prev, [payoutId]: result.accountNumber }));
    });

  const checkStatus = (payoutId: string) =>
    runAction(payoutId, async () => {
      const result = await trpcMutate<{ status: boolean; message: string }>('admin.payouts.reconciliation.checkOne', { payoutId });
      setCheckResult((prev) => ({ ...prev, [payoutId]: result.message }));
    });

  const retry = (payoutId: string) => runAction(payoutId, () => trpcMutate('admin.payouts.retry', { payoutId }));

  const submitManualReview = (reason?: string) => {
    if (!manualReviewModal || !reason) return;
    const id = manualReviewModal.id;
    runAction(id, () => trpcMutate('admin.payouts.moveToManualReview', { payoutId: id, reason })).then(() =>
      setManualReviewModal(null)
    );
  };

  const submitFail = (reason?: string) => {
    if (!failModal) return;
    const id = failModal.id;
    runAction(id, () => trpcMutate('admin.payouts.failManually', { payoutId: id, reason: reason || 'Marked failed by admin.' })).then(
      () => setFailModal(null)
    );
  };

  const submitComplete = () => {
    if (!completeModal || !completeForm.externalReference.trim()) return;
    const id = completeModal.id;
    runAction(id, () =>
      trpcMutate('admin.payouts.completeManually', {
        payoutId: id,
        externalReference: completeForm.externalReference.trim(),
        notes: completeForm.notes.trim() || undefined,
      })
    ).then(() => {
      setCompleteModal(null);
      setCompleteForm({ externalReference: '', notes: '' });
    });
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
                disabled={busy === p.id}
                onClick={() => revealAccountNumber(p.id, p.bankAccountId)}
              >
                Reveal
              </button>
            )}
          </>
        ) : (
          <span className="italic text-slate-300">—</span>
        ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (p) => <span className="tnum font-semibold text-slate-900">₦{p.amount.toLocaleString()}</span>,
    },
    {
      key: 'method',
      header: 'Method',
      render: (p) => (
        <>
          <p className="text-slate-700 capitalize">{p.payoutMethod}</p>
          {p.provider && <p className="text-xs text-slate-400 capitalize">{p.provider}</p>}
          {p.providerTransferReference && (
            <p className="text-[11px] text-slate-300" title={p.providerTransferReference}>
              {p.providerTransferReference.slice(0, 18)}…
            </p>
          )}
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <>
          <StatusLabel tone={payoutStatusTone[p.status]}>{p.status.replace('_', ' ')}</StatusLabel>
          {p.failureReason && <p className="mt-0.5 text-xs text-danger">{p.failureReason}</p>}
          {p.hasOpenReconciliation && <p className="mt-0.5 text-xs font-medium text-warning">Open reconciliation</p>}
          {checkResult[p.id] && <p className="mt-0.5 text-xs text-slate-400">{checkResult[p.id]}</p>}
        </>
      ),
    },
    { key: 'requested', header: 'Requested', render: (p) => <span className="whitespace-nowrap text-slate-500">{new Date(p.requestedAt).toLocaleDateString()}</span> },
    {
      key: 'action',
      header: 'Action',
      render: (p) => (
        <div className="flex flex-wrap gap-2">
          {p.status === 'processing' && (
            <>
              <Button variant="secondary" size="sm" disabled={busy === p.id} onClick={() => checkStatus(p.id)}>
                Check status
              </Button>
              <Button variant="warning" size="sm" disabled={busy === p.id} onClick={() => setManualReviewModal({ id: p.id })}>
                Move to review
              </Button>
            </>
          )}
          {p.status === 'manual_review' && (
            <>
              <Button variant="success" size="sm" disabled={busy === p.id} onClick={() => setCompleteModal({ id: p.id })}>
                Complete manually
              </Button>
              <Button variant="secondary" size="sm" disabled={busy === p.id} onClick={() => retry(p.id)}>
                Retry automatic
              </Button>
              <Button variant="danger" size="sm" disabled={busy === p.id} onClick={() => setFailModal({ id: p.id })}>
                Fail
              </Button>
            </>
          )}
          {p.status === 'failed' && (
            <Button variant="secondary" size="sm" disabled={busy === p.id} onClick={() => retry(p.id)}>
              Retry automatic
            </Button>
          )}
          {p.manualActions.length > 0 && (
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer select-none">History</summary>
              <ul className="mt-1 space-y-1">
                {p.manualActions.map((a) => (
                  <li key={a.id}>
                    {a.action.replace(/_/g, ' ')} — {new Date(a.createdAt).toLocaleString()}
                    {a.externalReference && <> · ref {a.externalReference}</>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Payouts" description="Driver withdrawal requests — automatic Paystack transfer by default, with a controlled, audited manual fallback." />

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

      {manualReviewModal && (
        <ConfirmModal
          title="Move to manual review"
          description="Pulls this payout out of the automatic path — an admin will need to complete or fail it by hand."
          reasonLabel="Reason"
          reasonPlaceholder="Why does this need manual handling?"
          confirmLabel="Move to review"
          confirmVariant="warning"
          processing={busy === manualReviewModal.id}
          onCancel={() => setManualReviewModal(null)}
          onConfirm={submitManualReview}
        />
      )}

      {failModal && (
        <ConfirmModal
          title="Mark as failed"
          description="Only available from manual review. Releases the reserved balance so the driver can request again."
          reasonLabel="Failure reason"
          reasonPlaceholder="Enter failure reason"
          confirmLabel="Confirm failed"
          confirmVariant="danger"
          processing={busy === failModal.id}
          onCancel={() => setFailModal(null)}
          onConfirm={submitFail}
        />
      )}

      {completeModal && (
        <Modal
          title="Complete payout manually"
          description="Before completing, Pantra re-checks with Paystack to make sure an automatic transfer hasn't already succeeded — this is refused if it has."
          onClose={() => setCompleteModal(null)}
          footer={
            <>
              <Button variant="secondary" className="flex-1" onClick={() => setCompleteModal(null)}>
                Cancel
              </Button>
              <Button
                variant="success"
                className="flex-1"
                disabled={busy === completeModal.id || !completeForm.externalReference.trim()}
                onClick={submitComplete}
              >
                Complete
              </Button>
            </>
          }
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">External transfer reference (required)</label>
            <input
              value={completeForm.externalReference}
              onChange={(e) => setCompleteForm((f) => ({ ...f, externalReference: e.target.value }))}
              placeholder="Bank transfer reference / receipt number"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Notes</label>
            <textarea
              value={completeForm.notes}
              onChange={(e) => setCompleteForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
