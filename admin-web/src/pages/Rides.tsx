import { useEffect, useState } from 'react';
import { Car, ChevronLeft, ChevronRight } from 'lucide-react';
import { trpcQuery } from '../lib/api';

interface RideRow {
  id: string;
  userId: string;
  driverId: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  rideType: string;
  status: string;
  fare: number;
  createdAt: string;
  userName: string;
  driverName: string | null;
}

interface RidesResponse {
  rides: RideRow[];
  total: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-blue-100 text-blue-700',
  'in-progress': 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const LIMIT = 50;

export default function Rides() {
  const [data, setData] = useState<RidesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [offset, setOffset] = useState(0);

  const load = (status: string, off: number) => {
    setLoading(true);
    setError(null);
    trpcQuery<RidesResponse>('admin.rides', {
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
      <h1 className="text-2xl font-bold text-gray-900">Rides</h1>

      <div className="flex flex-wrap gap-2">
        {['', 'pending', 'accepted', 'in-progress', 'completed', 'cancelled'].map((s) => (
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
            <Car size={16} className="text-gray-400" />
            <span className="text-sm text-gray-500">{total.toLocaleString()} rides</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600">Rider</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Driver</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Pickup</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Dropoff</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Type</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-right">Fare</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.rides ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-gray-400 py-10">No rides found.</td>
                  </tr>
                ) : (
                  (data?.rides ?? []).map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[120px] truncate">{r.userName}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate">
                        {r.driverName ?? <span className="text-gray-300 italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate" title={r.pickupAddress}>{r.pickupAddress}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate" title={r.dropoffAddress}>{r.dropoffAddress}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{r.rideType}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">₦{(r.fare ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</td>
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
    </div>
  );
}
