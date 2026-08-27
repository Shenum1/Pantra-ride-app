import { useState } from 'react';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { StatusLabel } from '../components/ui/StatusLabel';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterTabs } from '../components/ui/FilterTabs';
import { Table, type TableColumn } from '../components/ui/Table';
import { Field } from '../components/ui/Field';
import { rideStatusTone } from '../lib/status';
import { cancellationStage, elapsedLabel, buildRideTimeline } from '../lib/rideNarrative';

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
  bookingFee: number | null;
  serviceFee: number | null;
  zoneFee: number | null;
  waitingCharge: number | null;
  priorityFee: number | null;
  cancellationFee: number | null;
  distance: number | null;
  duration: number | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  createdAt: string;
  acceptedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  cancelReasonDetails: string | null;
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

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];
const LIMIT = 50;

function money(n: number | null | undefined) {
  return `₦${(n ?? 0).toLocaleString()}`;
}

function statusLabel(r: RideRow) {
  if (r.status === 'cancelled') return cancellationStage(r) ?? 'Cancelled';
  return r.status;
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

  const columns: TableColumn<RideRow>[] = [
    { key: 'rider', header: 'Rider', render: (r) => <span className="max-w-[120px] truncate font-medium text-slate-900">{r.userName}</span> },
    {
      key: 'driver',
      header: 'Driver',
      render: (r) => <span className="max-w-[120px] truncate text-slate-500">{r.driverName ?? <span className="italic text-slate-300">—</span>}</span>,
    },
    {
      key: 'route',
      header: 'Route',
      render: (r) => (
        <span className="max-w-[220px] truncate text-slate-600">
          {r.pickupAddress} <span className="text-slate-300">→</span> {r.dropoffAddress}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusLabel tone={rideStatusTone[r.status] ?? 'neutral'}>{statusLabel(r)}</StatusLabel>,
    },
    { key: 'fare', header: 'Fare', align: 'right', render: (r) => <span className="tnum font-medium text-slate-900">{money(r.fare)}</span> },
    { key: 'date', header: 'Date', render: (r) => <span className="whitespace-nowrap text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Trips" description="Expand a trip for the full timeline, fare, and commission breakdown." />

      <FilterTabs options={STATUS_OPTIONS} value={statusFilter} onChange={(v) => { setStatusFilter(v); setOffset(0); }} />

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{error}</div>
      ) : (
        <Table
          columns={columns}
          rows={rides}
          rowKey={(r) => r.id}
          loading={loading}
          countLabel={`${total.toLocaleString()} trips`}
          emptyTitle="No trips found"
          emptyDescription="Try a different status filter."
          onRowClick={(r) => setExpanded(expanded === r.id ? null : r.id)}
          expandedKey={expanded}
          renderExpanded={(r) => {
            const timeline = buildRideTimeline(r);
            return (
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Timeline</p>
                  <ol className="space-y-1.5">
                    {timeline.map((step, i) => (
                      <li key={step.label} className="flex items-center gap-3 text-sm">
                        <span className="w-32 flex-shrink-0 text-slate-700">{step.label}</span>
                        <span className="tnum text-slate-500">{new Date(step.at).toLocaleString()}</span>
                        {i > 0 && (
                          <span className="text-xs text-slate-400">+{elapsedLabel(timeline[i - 1].at, step.at)}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                  {r.status === 'cancelled' && r.cancelReason && (
                    <p className="mt-2 text-sm text-slate-600">
                      Reason: <span className="capitalize">{r.cancelReason.replace(/_/g, ' ')}</span>
                      {r.cancelReasonDetails ? ` — ${r.cancelReasonDetails}` : ''}
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Fare &amp; payment</p>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-4">
                    <Field label="Ride type" value={r.rideType} />
                    <Field label="Payment method" value={r.paymentMethod} />
                    <Field label="Payment status" value={r.paymentStatus} />
                    <Field label="Distance" value={r.distance ? `${r.distance.toFixed(1)} km` : null} />
                    <Field label="Base fare" value={money(r.baseFare)} mono />
                    <Field label="Booking fee" value={money(r.bookingFee)} mono />
                    <Field label="Service fee" value={money(r.serviceFee)} mono />
                    <Field label="Zone fee" value={money(r.zoneFee)} mono />
                    <Field label="Waiting charge" value={money(r.waitingCharge)} mono />
                    <Field label="Priority fee" value={money(r.priorityFee)} mono />
                    {r.cancellationFee ? <Field label="Cancellation fee" value={money(r.cancellationFee)} mono /> : null}
                    <Field
                      label="Platform commission"
                      value={`${money(r.platformCommissionAmount)} (${((r.platformCommissionRate ?? 0) * 100).toFixed(0)}%)`}
                      mono
                    />
                    <Field label="Driver earnings" value={money(r.driverEarningsAmount)} mono />
                  </div>
                </div>
              </div>
            );
          }}
          pagination={{ from, to, total, limit: LIMIT, onPrev: () => setOffset((o) => Math.max(0, o - LIMIT)), onNext: () => setOffset((o) => o + LIMIT) }}
        />
      )}
    </div>
  );
}
