import { useState } from 'react';
import { trpcMutate, trpcQuery } from '../lib/api';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { StatusLabel } from '../components/ui/StatusLabel';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterTabs } from '../components/ui/FilterTabs';
import { Table, type TableColumn } from '../components/ui/Table';
import { refundStatusTone } from '../lib/status';

type RefundStatus = 'requested' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'reversed' | 'unknown';
type OriginalPaymentType = 'wallet_topup' | 'ride_wallet_payment';

interface RefundRow {
  id: string;
  originalPaymentType: OriginalPaymentType;
  paymentIntentId: string | null;
  rideId: string | null;
  userId: string;
  provider: 'paystack' | 'flutterwave' | null;
  refundReference: string;
  providerRefundId: string | null;
  originalAmount: number;
  amount: number;
  currency: string;
  reason: string | null;
  refundType: 'full' | 'partial';
  status: RefundStatus;
  requestedBy: string;
  driverImpactAmount: number | null;
  requiresDriverAdjustmentReview: boolean;
  failureReason?: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
  requestedByAdmin: { name: string; email: string } | null;
  hasOpenReconciliation: boolean;
}

interface RefundsResponse {
  refunds: RefundRow[];
  total: number;
}

interface EligibilityResponse {
  eligible: boolean;
  reason: string | null;
  userId?: string;
  provider?: string | null;
  originalAmount?: number;
  currency?: string;
  alreadyRefunded?: number;
  refundable?: number;
  previousRefunds?: { id: string; amount: number; status: string; reason: string | null; createdAt: string }[];
}

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'requested', label: 'Requested' },
  { value: 'processing', label: 'Processing' },
  { value: 'unknown', label: 'Unknown' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'reversed', label: 'Reversed' },
];
const LIMIT = 50;

function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `refund-${Date.now()}-${Math.random()}`;
}

export default function Refunds() {
  const [statusFilter, setStatusFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<Record<string, string>>({});

  const [newModalOpen, setNewModalOpen] = useState(false);
  const [form, setForm] = useState<{
    originalPaymentType: OriginalPaymentType;
    sourceId: string;
    amount: string;
    reason: string;
    idempotencyKey: string;
  }>({ originalPaymentType: 'ride_wallet_payment', sourceId: '', amount: '', reason: '', idempotencyKey: newIdempotencyKey() });
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, error, refetch } = useTrpcQuery<RefundsResponse>(
    'admin.refunds.list',
    { status: statusFilter || undefined, limit: LIMIT, offset },
    [statusFilter, offset]
  );

  const refunds = data?.refunds ?? [];
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + LIMIT, total);

  const openNewModal = () => {
    setForm({ originalPaymentType: 'ride_wallet_payment', sourceId: '', amount: '', reason: '', idempotencyKey: newIdempotencyKey() });
    setEligibility(null);
    setNewModalOpen(true);
  };

  const checkEligibility = async () => {
    if (!form.sourceId.trim()) return;
    setCheckingEligibility(true);
    setEligibility(null);
    try {
      const input =
        form.originalPaymentType === 'wallet_topup'
          ? { originalPaymentType: 'wallet_topup', paymentIntentId: form.sourceId.trim() }
          : { originalPaymentType: 'ride_wallet_payment', rideId: form.sourceId.trim() };
      const result = await trpcQuery<EligibilityResponse>('admin.refunds.eligibility', input);
      setEligibility(result);
      if (result.eligible && result.refundable) {
        setForm((f) => ({ ...f, amount: String(result.refundable) }));
      }
    } catch (e) {
      setEligibility({ eligible: false, reason: (e as Error).message });
    } finally {
      setCheckingEligibility(false);
    }
  };

  const submitRefund = async () => {
    if (!eligibility?.eligible || !form.amount || !form.reason.trim()) return;
    setSubmitting(true);
    try {
      const input =
        form.originalPaymentType === 'wallet_topup'
          ? { originalPaymentType: 'wallet_topup', paymentIntentId: form.sourceId.trim() }
          : { originalPaymentType: 'ride_wallet_payment', rideId: form.sourceId.trim() };
      await trpcMutate('admin.refunds.request', {
        ...input,
        amount: Number(form.amount),
        reason: form.reason.trim(),
        idempotencyKey: form.idempotencyKey,
      });
      setNewModalOpen(false);
      await refetch();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const checkStatus = async (refundId: string) => {
    setBusy(refundId);
    try {
      const result = await trpcMutate<{ status: boolean; message: string }>('admin.refunds.reconciliation.checkOne', { refundId });
      setCheckResult((prev) => ({ ...prev, [refundId]: result.message }));
      await refetch();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const columns: TableColumn<RefundRow>[] = [
    {
      key: 'user',
      header: 'Rider',
      render: (r) => (
        <>
          <p className="font-medium text-slate-900">{r.user?.name ?? '—'}</p>
          <p className="text-xs text-slate-400">{r.user?.email}</p>
        </>
      ),
    },
    {
      key: 'source',
      header: 'Original payment',
      render: (r) => (
        <>
          <p className="text-slate-700">{r.originalPaymentType === 'wallet_topup' ? 'Wallet top-up' : 'Ride (wallet-paid)'}</p>
          <p className="text-xs text-slate-400">{r.provider ?? '—'}</p>
        </>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (r) => (
        <>
          <span className="tnum font-semibold text-slate-900">₦{r.amount.toLocaleString()}</span>
          <p className="text-xs text-slate-400">of ₦{r.originalAmount.toLocaleString()} · {r.refundType}</p>
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <>
          <StatusLabel tone={refundStatusTone[r.status]}>{r.status}</StatusLabel>
          {r.failureReason && <p className="mt-0.5 text-xs text-danger">{r.failureReason}</p>}
          {r.requiresDriverAdjustmentReview && (
            <p className="mt-0.5 text-xs font-medium text-warning">
              Driver impact: ₦{(r.driverImpactAmount ?? 0).toLocaleString()} — review required
            </p>
          )}
          {r.hasOpenReconciliation && <p className="mt-0.5 text-xs font-medium text-warning">Open reconciliation</p>}
          {checkResult[r.id] && <p className="mt-0.5 text-xs text-slate-400">{checkResult[r.id]}</p>}
        </>
      ),
    },
    {
      key: 'requestedBy',
      header: 'Requested by',
      render: (r) => (
        <>
          <p className="text-slate-700">{r.requestedByAdmin?.name ?? '—'}</p>
          <p className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleString()}</p>
          {r.reason && <p className="text-xs text-slate-400" title={r.reason}>{r.reason.slice(0, 40)}</p>}
        </>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (r) =>
        r.originalPaymentType === 'wallet_topup' && (r.status === 'processing' || r.status === 'unknown') ? (
          <Button variant="secondary" size="sm" disabled={busy === r.id} onClick={() => checkStatus(r.id)}>
            Check status
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Refunds"
        description="Wallet top-up and wallet-paid ride refunds. A refund never rewrites the original payment — it is always a new, linked financial event."
        action={<Button onClick={openNewModal}>New refund</Button>}
      />

      <FilterTabs options={STATUS_OPTIONS} value={statusFilter} onChange={(v) => { setStatusFilter(v); setOffset(0); }} />

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{error}</div>
      ) : (
        <Table
          columns={columns}
          rows={refunds}
          rowKey={(r) => r.id}
          loading={loading}
          countLabel={`${total.toLocaleString()} refund${total !== 1 ? 's' : ''}`}
          emptyTitle="No refunds"
          emptyDescription="Try a different status filter."
          pagination={{ from, to, total, limit: LIMIT, onPrev: () => setOffset((o) => Math.max(0, o - LIMIT)), onNext: () => setOffset((o) => o + LIMIT) }}
        />
      )}

      {newModalOpen && (
        <Modal
          title="New refund"
          description="Cash and card rides are not refundable through this system — only wallet top-ups and rides paid from wallet balance."
          width="md"
          onClose={() => setNewModalOpen(false)}
          footer={
            <>
              <Button variant="secondary" className="flex-1" onClick={() => setNewModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                disabled={submitting || !eligibility?.eligible || !form.amount || !form.reason.trim()}
                onClick={submitRefund}
              >
                {submitting ? 'Submitting…' : 'Submit refund'}
              </Button>
            </>
          }
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Type</label>
            <select
              value={form.originalPaymentType}
              onChange={(e) => {
                setForm((f) => ({ ...f, originalPaymentType: e.target.value as OriginalPaymentType, sourceId: '' }));
                setEligibility(null);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="ride_wallet_payment">Ride paid from wallet balance</option>
              <option value="wallet_topup">Wallet top-up (Paystack/Flutterwave)</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              {form.originalPaymentType === 'wallet_topup' ? 'Payment intent ID' : 'Ride ID'}
            </label>
            <div className="flex gap-2">
              <input
                value={form.sourceId}
                onChange={(e) => {
                  setForm((f) => ({ ...f, sourceId: e.target.value }));
                  setEligibility(null);
                }}
                placeholder="UUID"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <Button variant="secondary" size="sm" disabled={checkingEligibility || !form.sourceId.trim()} onClick={checkEligibility}>
                {checkingEligibility ? 'Checking…' : 'Check'}
              </Button>
            </div>
          </div>

          {eligibility && (
            <div className={`rounded-md border p-3 text-xs ${eligibility.eligible ? 'border-success/30 bg-success-tint' : 'border-danger/30 bg-danger-tint'}`}>
              {eligibility.eligible ? (
                <>
                  <p>Original amount: ₦{eligibility.originalAmount?.toLocaleString()}</p>
                  <p>Already refunded: ₦{(eligibility.alreadyRefunded ?? 0).toLocaleString()}</p>
                  <p className="font-semibold">Refundable: ₦{eligibility.refundable?.toLocaleString()}</p>
                  {eligibility.previousRefunds && eligibility.previousRefunds.length > 0 && (
                    <p className="mt-1 text-slate-500">{eligibility.previousRefunds.length} previous refund(s) on this payment.</p>
                  )}
                </>
              ) : (
                <p>{eligibility.reason ?? 'Not eligible for refund.'}</p>
              )}
            </div>
          )}

          {eligibility?.eligible && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Amount (₦) — full or partial</label>
                <input
                  type="number"
                  min={0.01}
                  max={eligibility.refundable}
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Reason (required)</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  rows={2}
                  className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
