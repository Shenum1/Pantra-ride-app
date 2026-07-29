import { useEffect, useState } from 'react';
import { Wallet, ChevronLeft, ChevronRight } from 'lucide-react';
import { trpcQuery, trpcMutate } from '../lib/api';

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

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const LIMIT = 50;

export default function Payouts() {
  const [data, setData] = useState<PayoutsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'processing' | 'completed' | 'failed' | ''>('pending');
  const [offset, setOffset] = useState(0);
  const [updating, setUpdating] = useState<string | null>(null);
  const [failModal, setFailModal] = useState<{ id: string } | null>(null);
  const [failReason, setFailReason] = useState('');

  const load = (status: typeof statusFilter, off: number) => {
    setLoading(true);
    setError(null);
    trpcQuery<PayoutsResponse>('admin.payouts.list', {
      status: status || undefined,
      limit: LIMIT,
      offset: off,
    })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setOffset(0);
    load(statusFilter, 0);
  }, [statusFilter]);

  const updateStatus = async (id: string, status: 'processing' | 'completed' | 'failed', failureReason?: string) => {
    setUpdating(id);
    try {
      await trpcMutate('admin.payouts.updateStatus', { id, status, failureReason });
      setData((prev) =>
        prev ? { ...prev, payouts: prev.payouts.map((p) => p.id === id ? { ...p, status, failureReason } : p) } : null
      );
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setUpdating(null);
      setFailModal(null);
      setFailReason('');
    }
  };

  const handlePage = (dir: 'prev' | 'next') => {
    const next = dir === 'next' ? offset + LIMIT : Math.max(0, offset - LIMIT);
    setOffset(next);
    load(statusFilter, next);
  };

  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + LIMIT, total);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Driver Payouts</h1>

      <div className="flex flex-wrap gap-2">
        {(['', 'pending', 'processing', 'completed', 'failed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors
              ${statusFilter === s ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {s === '' ? 'All' : s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">{error}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Wallet size={16} className="text-gray-400" />
            <span className="text-sm text-gray-500">{total.toLocaleString()} payout request{total !== 1 ? 's' : ''}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600">Driver</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Bank Account</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-right">Amount</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Requested</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.payouts ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-400 py-10">No payout requests.</td>
                  </tr>
                ) : (
                  (data?.payouts ?? []).map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{p.driver?.name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{p.driver?.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        {p.bankAccount ? (
                          <>
                            <p className="text-gray-700">{p.bankAccount.bankName}</p>
                            <p className="text-xs text-gray-400">{p.bankAccount.accountNumber} · {p.bankAccount.accountName}</p>
                          </>
                        ) : (
                          <span className="text-gray-300 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">₦{p.amount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[p.status]}`}>
                          {p.status}
                        </span>
                        {p.failureReason && <p className="text-xs text-red-500 mt-0.5">{p.failureReason}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(p.requestedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {p.status === 'pending' && (
                          <button
                            disabled={updating === p.id}
                            onClick={() => updateStatus(p.id, 'processing')}
                            className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                          >
                            Mark Processing
                          </button>
                        )}
                        {p.status === 'processing' && (
                          <div className="flex gap-2">
                            <button
                              disabled={updating === p.id}
                              onClick={() => updateStatus(p.id, 'completed')}
                              className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                              Paid
                            </button>
                            <button
                              disabled={updating === p.id}
                              onClick={() => setFailModal({ id: p.id })}
                              className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                              Failed
                            </button>
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
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500">{from}–{to} of {total.toLocaleString()}</span>
              <div className="flex gap-2">
                <button onClick={() => handlePage('prev')} disabled={offset === 0} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => handlePage('next')} disabled={to >= total} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {failModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Mark as Failed</h3>
            <textarea
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="Enter failure reason (optional)"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => { setFailModal(null); setFailReason(''); }} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => updateStatus(failModal.id, 'failed', failReason || undefined)} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-semibold transition-colors">
                Confirm Failed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
