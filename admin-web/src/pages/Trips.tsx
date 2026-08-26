import { Fragment, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { TableSkeleton } from '../components/ui/Skeleton';
import { rideStatusTone } from '../lib/status';

interface RideRow {
  id: string;
  userId: string;
  driverId: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  rideType: string;
  status: string;
  fare: number;
  baseFare: number | null;
  minFare: number | null;
  maxFare: number | null;
  bookingFee: number | null;
  serviceFee: number | null;
  zoneFee: number | null;
  fareAdjustmentPercent: number | null;
  distance: number | null;
  duration: number | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  platformCommissionRate: number | null;
  platformCommissionAmount: number | null;
  driverEarningsAmount: number | null;
  userName: string;
  driverName: string | null;
}

interface RidesResponse {
  rides: RideRow[];
  total: number;
}

const STATUSES = ['', 'pending', 'accepted', 'in-progress', 'completed', 'cancelled'];
const LIMIT = 50;

function money(n: number | null | undefined) {
  return `₦${(n ?? 0).toLocaleString()}`;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="tnum mt-0.5 text-sm text-slate-800">{value}</p>
    </div>
  );
}

export default function Trips() {
  const [statusFilter, setStatusFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, loading, error } = useTrpcQuery<RidesResponse>(
    'admin.rides',
    { status: statusFilter || undefined, limit: LIMIT, offset },
    [statusFilter, offset]
  );

  const rides = data?.rides ?? [];
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + LIMIT, total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Trips</h1>
        <p className="mt-1 text-sm text-slate-500">Expand a trip for the full fare, commission, and payment breakdown.</p>
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
            {loading ? 'Loading…' : `${total.toLocaleString()} trips`}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="w-8" />
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Rider</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Driver</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Route</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Fare</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <TableSkeleton rows={8} cols={7} />
                ) : rides.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <EmptyState title="No trips found" description="Try a different status filter." />
                    </td>
                  </tr>
                ) : (
                  rides.map((r) => {
                    const isOpen = expanded === r.id;
                    return (
                      <Fragment key={r.id}>
                        <tr
                          onClick={() => setExpanded(isOpen ? null : r.id)}
                          className="cursor-pointer transition-colors hover:bg-slate-50"
                        >
                          <td className="px-2 text-slate-400">{isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                          <td className="max-w-[120px] truncate px-4 py-3 font-medium text-slate-900">{r.userName}</td>
                          <td className="max-w-[120px] truncate px-4 py-3 text-slate-500">{r.driverName ?? <span className="italic text-slate-300">—</span>}</td>
                          <td className="max-w-[220px] truncate px-4 py-3 text-slate-600">
                            {r.pickupAddress} <span className="text-slate-300">→</span> {r.dropoffAddress}
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={rideStatusTone[r.status] ?? 'neutral'}>{r.status}</Badge>
                          </td>
                          <td className="tnum px-4 py-3 text-right font-medium text-slate-900">{money(r.fare)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={7} className="bg-slate-50 px-8 py-5">
                              <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-4">
                                <DetailField label="Ride type" value={r.rideType} />
                                <DetailField label="Payment method" value={r.paymentMethod ?? '—'} />
                                <DetailField label="Payment status" value={r.paymentStatus ?? '—'} />
                                <DetailField label="Distance" value={r.distance ? `${r.distance.toFixed(1)} km` : '—'} />
                                <DetailField label="Duration" value={r.duration ? `${Math.round(r.duration)} min` : '—'} />
                                <DetailField label="Base fare" value={money(r.baseFare)} />
                                <DetailField label="Booking fee" value={money(r.bookingFee)} />
                                <DetailField label="Service fee" value={money(r.serviceFee)} />
                                <DetailField label="Zone fee" value={money(r.zoneFee)} />
                                <DetailField label="Platform commission" value={`${money(r.platformCommissionAmount)} (${((r.platformCommissionRate ?? 0) * 100).toFixed(0)}%)`} />
                                <DetailField label="Driver earnings" value={money(r.driverEarningsAmount)} />
                                <DetailField label="Completed" value={r.completedAt ? new Date(r.completedAt).toLocaleString() : '—'} />
                                <DetailField label="Cancelled" value={r.cancelledAt ? new Date(r.cancelledAt).toLocaleString() : '—'} />
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
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
    </div>
  );
}
