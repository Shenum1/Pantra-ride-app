import { useState } from 'react';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { trpcMutate } from '../lib/api';
import { StatusLabel } from '../components/ui/StatusLabel';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterTabs } from '../components/ui/FilterTabs';
import { Table, type TableColumn } from '../components/ui/Table';
import { paymentStatusTone, reconciliationStatusTone } from '../lib/status';

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

interface ReconciliationRow {
  id: string;
  provider: string;
  reference: string;
  expectedAmount: number | null;
  providerAmount: number | null;
  currency: string | null;
  pantraStatus: string | null;
  providerStatus: string | null;
  mismatchType: string;
  reconciliationStatus: 'open' | 'resolved' | 'ignored';
  detectedAt: string;
  resolvedAt: string | null;
  notes: string | null;
}

interface ReconciliationResponse {
  records: ReconciliationRow[];
  total: number;
}

const LIMIT = 50;
const TABS: { value: 'transactions' | 'tips' | 'reconciliation'; label: string }[] = [
  { value: 'transactions', label: 'Transactions' },
  { value: 'tips', label: 'Tips' },
  { value: 'reconciliation', label: 'Reconciliation' },
];

export default function Payments() {
  const [tab, setTab] = useState<'transactions' | 'tips' | 'reconciliation'>('transactions');
  const [offset, setOffset] = useState(0);
  const [running, setRunning] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

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
  const {
    data: reconciliationData,
    loading: reconciliationLoading,
    setData: setReconciliationData,
  } = useTrpcQuery<ReconciliationResponse>(
    'admin.payments.reconciliation.list',
    { status: 'open', limit: LIMIT, offset },
    [offset, tab]
  );

  const total =
    tab === 'transactions' ? data?.total ?? 0 : tab === 'tips' ? tipsData?.total ?? 0 : reconciliationData?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + LIMIT, total);
  const pagination = { from, to, total, limit: LIMIT, onPrev: () => setOffset((o) => Math.max(0, o - LIMIT)), onNext: () => setOffset((o) => o + LIMIT) };

  const runReconciliation = async () => {
    setRunning(true);
    try {
      const result = await trpcMutate<{ checked: number }>('admin.payments.reconciliation.run', { olderThanMinutes: 15, limit: 50 });
      alert(`Checked ${result.checked} stale payment(s). Refresh to see any new reconciliation records.`);
      setOffset(0);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const resolveRecord = async (id: string, status: 'resolved' | 'ignored') => {
    setResolvingId(id);
    try {
      await trpcMutate('admin.payments.reconciliation.resolve', { id, status });
      setReconciliationData((prev) =>
        prev ? { ...prev, records: prev.records.filter((r) => r.id !== id) } : prev
      );
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setResolvingId(null);
    }
  };

  const transactionColumns: TableColumn<TransactionRow>[] = [
    { key: 'user', header: 'User', render: (t) => <span className="max-w-[140px] truncate font-medium text-slate-900">{t.userName || '—'}</span> },
    { key: 'type', header: 'Type', render: (t) => <span className="capitalize text-slate-600">{t.type.replace(/_/g, ' ')}</span> },
    { key: 'description', header: 'Description', render: (t) => <span className="max-w-[200px] truncate text-slate-500">{t.description || '—'}</span> },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (t) => (
        <span className={`tnum font-medium ${t.amount < 0 ? 'text-danger' : 'text-slate-900'}`}>
          {t.amount < 0 ? '−' : '+'}₦{Math.abs(t.amount).toLocaleString()}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (t) => <StatusLabel tone={paymentStatusTone[t.status] ?? 'pending'}>{t.status}</StatusLabel> },
    { key: 'date', header: 'Date', render: (t) => <span className="whitespace-nowrap text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</span> },
  ];

  const tipColumns: TableColumn<TipRow>[] = [
    { key: 'rider', header: 'Rider', render: (t) => <span className="max-w-[140px] truncate font-medium text-slate-900">{t.riderName}</span> },
    { key: 'driver', header: 'Driver', render: (t) => <span className="max-w-[140px] truncate text-slate-600">{t.driverName}</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: (t) => <span className="tnum font-medium text-slate-900">₦{t.amount.toLocaleString()}</span> },
    { key: 'status', header: 'Status', render: (t) => <StatusLabel tone={paymentStatusTone[t.status] ?? 'pending'}>{t.status}</StatusLabel> },
    { key: 'date', header: 'Date', render: (t) => <span className="whitespace-nowrap text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</span> },
  ];

  const reconciliationColumns: TableColumn<ReconciliationRow>[] = [
    { key: 'provider', header: 'Provider', render: (r) => <span className="capitalize text-slate-700">{r.provider}</span> },
    { key: 'reference', header: 'Reference', render: (r) => <span className="max-w-[180px] truncate text-xs text-slate-500">{r.reference}</span> },
    { key: 'mismatch', header: 'Mismatch', render: (r) => <span className="text-slate-700">{r.mismatchType.replace(/_/g, ' ')}</span> },
    {
      key: 'amounts',
      header: 'Expected / Provider',
      align: 'right',
      render: (r) => (
        <span className="tnum text-slate-600">
          {r.expectedAmount != null ? `₦${r.expectedAmount.toLocaleString()}` : '—'} / {r.providerAmount != null ? `₦${r.providerAmount.toLocaleString()}` : '—'}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusLabel tone={reconciliationStatusTone[r.reconciliationStatus]}>{r.reconciliationStatus}</StatusLabel> },
    { key: 'detected', header: 'Detected', render: (r) => <span className="whitespace-nowrap text-slate-500">{new Date(r.detectedAt).toLocaleDateString()}</span> },
    {
      key: 'action',
      header: 'Action',
      render: (r) => (
        <div className="flex gap-2">
          <Button variant="success" size="sm" disabled={resolvingId === r.id} onClick={() => resolveRecord(r.id, 'resolved')}>
            Resolve
          </Button>
          <Button variant="secondary" size="sm" disabled={resolvingId === r.id} onClick={() => resolveRecord(r.id, 'ignored')}>
            Ignore
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Platform-wide wallet ledger — read-only." />

      <div className="flex items-center justify-between">
        <FilterTabs options={TABS} value={tab} onChange={(v) => { setTab(v); setOffset(0); }} />
        {tab === 'reconciliation' && (
          <Button variant="primary" size="sm" disabled={running} onClick={runReconciliation}>
            {running ? 'Running…' : 'Run reconciliation'}
          </Button>
        )}
      </div>

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{error}</div>
      ) : tab === 'transactions' ? (
        <Table columns={transactionColumns} rows={data?.transactions ?? []} rowKey={(t) => t.id} loading={loading} emptyTitle="No transactions" pagination={pagination} />
      ) : tab === 'tips' ? (
        <Table columns={tipColumns} rows={tipsData?.tips ?? []} rowKey={(t) => t.id} loading={tipsLoading} emptyTitle="No tips yet" pagination={pagination} />
      ) : (
        <Table
          columns={reconciliationColumns}
          rows={reconciliationData?.records ?? []}
          rowKey={(r) => r.id}
          loading={reconciliationLoading}
          emptyTitle="No open reconciliation records"
          emptyDescription="Nothing needs manual review right now."
          pagination={pagination}
        />
      )}
    </div>
  );
}
