import { useState } from 'react';
import { trpcMutate } from '../lib/api';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { StatusLabel } from '../components/ui/StatusLabel';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterTabs } from '../components/ui/FilterTabs';
import { Table, type TableColumn } from '../components/ui/Table';

interface LedgerEntry {
  id: string;
  rideId: string | null;
  type: 'cash_commission_debit' | 'cash_commission_settlement' | 'adjustment';
  amount: number;
  reason: string | null;
  reference: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface DriverCommissionRow {
  driverId: string;
  netBalance: number;
  amountOwed: number;
  limit: number;
  blocked: boolean;
  totalCommission: number;
  totalSettled: number;
  lastSettlementAt: string | null;
  driver: { name: string | null; email: string | null; phone: string | null } | null;
  recentEntries: LedgerEntry[];
}

interface CommissionResponse {
  limit: number;
  drivers: DriverCommissionRow[];
}

interface RecordTarget {
  driverId: string;
  driverName: string;
  amountOwed: number;
}

const FILTER_OPTIONS = [
  { value: 'owing', label: 'Owing' },
  { value: 'all', label: 'All drivers' },
];

const ENTRY_LABEL: Record<LedgerEntry['type'], string> = {
  cash_commission_debit: 'Cash ride commission',
  cash_commission_settlement: 'Payment',
  adjustment: 'Adjustment',
};

const naira = (value: number) => `₦${value.toLocaleString()}`;

export default function Commission() {
  const [filter, setFilter] = useState('owing');
  const [busy, setBusy] = useState(false);
  const [recordTarget, setRecordTarget] = useState<RecordTarget | null>(null);
  const [form, setForm] = useState({ amount: '', reference: '', notes: '' });

  const { data, loading, error, refetch } = useTrpcQuery<CommissionResponse>(
    'admin.commission.list',
    { owingOnly: filter === 'owing' },
    [filter]
  );

  const rows = data?.drivers ?? [];
  const limit = data?.limit ?? 0;

  const openRecord = (row: DriverCommissionRow) => {
    setRecordTarget({ driverId: row.driverId, driverName: row.driver?.name ?? 'this driver', amountOwed: row.amountOwed });
    setForm({ amount: String(row.amountOwed), reference: '', notes: '' });
  };

  const closeRecord = () => {
    setRecordTarget(null);
    setForm({ amount: '', reference: '', notes: '' });
  };

  const amountValue = Number(form.amount);
  const amountProblem =
    !recordTarget || !form.amount
      ? null
      : !(amountValue > 0)
        ? 'Enter an amount greater than zero.'
        : amountValue > recordTarget.amountOwed
          ? `That's more than they owe (${naira(recordTarget.amountOwed)}).`
          : null;
  const canSubmit = !!recordTarget && !!form.amount && !amountProblem && !!form.reference.trim();

  const submitRecord = async () => {
    if (!recordTarget || !canSubmit) return;
    setBusy(true);
    try {
      await trpcMutate('admin.commission.recordPayment', {
        driverId: recordTarget.driverId,
        amount: amountValue,
        externalReference: form.reference.trim(),
        notes: form.notes.trim() || undefined,
      });
      closeRecord();
      await refetch();
    } catch (e) {
      // Keep the modal open so the admin can correct and resubmit.
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const columns: TableColumn<DriverCommissionRow>[] = [
    {
      key: 'driver',
      header: 'Driver',
      render: (r) => (
        <>
          <p className="font-medium text-slate-900">{r.driver?.name ?? '—'}</p>
          <p className="text-xs text-slate-400">{r.driver?.email ?? r.driver?.phone}</p>
        </>
      ),
    },
    {
      key: 'owed',
      header: 'Owes',
      align: 'right',
      render: (r) => (
        <span className={`tnum font-semibold ${r.amountOwed > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
          {naira(r.amountOwed)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Cash rides',
      render: (r) =>
        r.blocked ? (
          <StatusLabel tone="danger">Paused</StatusLabel>
        ) : (
          <StatusLabel tone={r.amountOwed > 0 ? 'pending' : 'success'}>Allowed</StatusLabel>
        ),
    },
    {
      key: 'history',
      header: 'Commission / paid to date',
      align: 'right',
      render: (r) => (
        <>
          <p className="tnum text-slate-700">{naira(r.totalCommission)}</p>
          <p className="tnum text-xs text-slate-400">{naira(r.totalSettled)} paid</p>
        </>
      ),
    },
    {
      key: 'lastPayment',
      header: 'Last payment',
      render: (r) => (
        <span className="whitespace-nowrap text-slate-500">
          {r.lastSettlementAt ? new Date(r.lastSettlementAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (r) => (
        <div className="flex flex-wrap items-start gap-2">
          {r.amountOwed > 0 && (
            <Button variant="success" size="sm" onClick={() => openRecord(r)}>
              Record payment
            </Button>
          )}
          {r.recentEntries.length > 0 && (
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer select-none">History</summary>
              <ul className="mt-1 space-y-1">
                {r.recentEntries.map((entry) => (
                  <li key={entry.id}>
                    <span className={entry.amount < 0 ? 'text-slate-600' : 'text-success'}>
                      {entry.amount < 0 ? '−' : '+'}
                      {naira(Math.abs(entry.amount))}
                    </span>{' '}
                    {ENTRY_LABEL[entry.type]} — {new Date(entry.createdAt).toLocaleDateString()}
                    {entry.reference && <> · ref {entry.reference}</>}
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
      <PageHeader
        title="Cash commission"
        description={`Commission drivers owe Pantra on cash rides, where they keep the whole fare. Drivers owing more than ${naira(limit)} can't take cash rides until they pay — in the app, or by bank transfer you record here.`}
      />

      <FilterTabs options={FILTER_OPTIONS} value={filter} onChange={setFilter} />

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{error}</div>
      ) : (
        <Table
          columns={columns}
          rows={rows}
          rowKey={(r) => r.driverId}
          loading={loading}
          countLabel={`${rows.length.toLocaleString()} driver${rows.length !== 1 ? 's' : ''}`}
          emptyTitle={filter === 'owing' ? 'No driver owes commission' : 'No cash commission yet'}
          emptyDescription={filter === 'owing' ? 'Every driver is settled up.' : 'Commission appears here once drivers complete cash rides.'}
        />
      )}

      {recordTarget && (
        <Modal
          title="Record commission payment"
          description={`Only record a payment once you've confirmed the money reached Pantra's account. ${recordTarget.driverName} owes ${naira(recordTarget.amountOwed)}.`}
          onClose={closeRecord}
          footer={
            <>
              <Button variant="secondary" className="flex-1" onClick={closeRecord}>
                Cancel
              </Button>
              <Button variant="success" className="flex-1" disabled={busy || !canSubmit} onClick={submitRecord}>
                Record payment
              </Button>
            </>
          }
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Amount received (₦)</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {amountProblem && <p className="mt-1 text-xs text-danger">{amountProblem}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Transfer reference (required)</label>
            <input
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              placeholder="Bank transfer reference / receipt number"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
