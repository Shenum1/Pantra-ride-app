import { useState } from 'react';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { StatusLabel } from '../components/ui/StatusLabel';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterTabs } from '../components/ui/FilterTabs';
import { Table, type TableColumn } from '../components/ui/Table';
import { paymentStatusTone } from '../lib/status';

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

const LIMIT = 50;
const TABS: { value: 'transactions' | 'tips'; label: string }[] = [
  { value: 'transactions', label: 'Transactions' },
  { value: 'tips', label: 'Tips' },
];

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
  const pagination = { from, to, total, limit: LIMIT, onPrev: () => setOffset((o) => Math.max(0, o - LIMIT)), onNext: () => setOffset((o) => o + LIMIT) };

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

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Platform-wide wallet ledger — read-only." />

      <FilterTabs options={TABS} value={tab} onChange={(v) => { setTab(v); setOffset(0); }} />

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{error}</div>
      ) : tab === 'transactions' ? (
        <Table columns={transactionColumns} rows={data?.transactions ?? []} rowKey={(t) => t.id} loading={loading} emptyTitle="No transactions" pagination={pagination} />
      ) : (
        <Table columns={tipColumns} rows={tipsData?.tips ?? []} rowKey={(t) => t.id} loading={tipsLoading} emptyTitle="No tips yet" pagination={pagination} />
      )}
    </div>
  );
}
