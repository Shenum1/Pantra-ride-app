import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { trpcMutate } from '../lib/api';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { StatusLabel } from '../components/ui/StatusLabel';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Table, type TableColumn } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';

interface TierConfig {
  id: 'standard' | 'comfort' | 'xl';
  name: string;
  base: number;
  perKm: number;
  perMin: number;
  minFare: number;
  bookingFee: number;
  serviceFee: number;
}

interface TrafficRule {
  id: string;
  label: string;
  daysOfWeek: number[] | null;
  startMinute: number | null;
  endMinute: number | null;
  multiplier: number;
  isEnabled: boolean;
}

interface PriorityConfig {
  id: string;
  fee: number;
  isEnabled: boolean;
}

interface SurgeConfig {
  id: string;
  minMultiplier: number;
  maxMultiplier: number;
  highDemandRatio: number;
  lowDemandRatio: number;
  lowAcceptanceThreshold: number;
  lowAcceptanceBonus: number;
  acceptanceLookbackMinutes: number;
  isEnabled: boolean;
}

interface CommissionConfig {
  id: string;
  rate: number;
}

interface WaitingChargeConfig {
  id: string;
  graceMinutes: number;
  perMinuteRate: number;
}

interface CancellationFeeConfig {
  id: string;
  freeWindowSeconds: number;
  afterAcceptFee: number;
  afterArrivalFee: number;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function minutesToTime(m: number | null): string {
  if (m == null) return '';
  const h = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${h}:${mm}`;
}

function timeToMinutes(v: string): number | undefined {
  if (!v) return undefined;
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </label>
  );
}

// A live value + an edit affordance, without wrapping every config in its own
// bordered card — the summary card style. Used for the single-row configs
// below the tiers/rules tables.
function ConfigCard({ children, onEdit }: { children: React.ReactNode; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-white p-4">
      <div className="min-w-0">{children}</div>
      <button onClick={onEdit} className="flex-shrink-0 rounded-md p-1.5 hover:bg-slate-100">
        <Pencil size={14} className="text-slate-500" />
      </button>
    </div>
  );
}

function ModalFooter({ onCancel, onSave, saveLabel = 'Save' }: { onCancel: () => void; onSave: () => void; saveLabel?: string }) {
  return (
    <>
      <Button variant="secondary" className="flex-1" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="primary" className="flex-1" onClick={onSave}>
        {saveLabel}
      </Button>
    </>
  );
}

export default function Pricing() {
  const { data: tiersData, loading: tiersLoading, refetch: refetchTiers } = useTrpcQuery<{ tiers: TierConfig[] }>('admin.pricing.tiers.list');
  const { data: rulesData, loading: rulesLoading, refetch: refetchRules } = useTrpcQuery<{ rules: TrafficRule[] }>('admin.pricing.trafficRules.list');
  const { data: priorityData, refetch: refetchPriority } = useTrpcQuery<{ config: PriorityConfig }>('admin.pricing.priority.get');
  const { data: surgeData, refetch: refetchSurge } = useTrpcQuery<{ config: SurgeConfig }>('admin.pricing.surge.get');
  const { data: commissionData, refetch: refetchCommission } = useTrpcQuery<{ config: CommissionConfig }>('admin.pricing.commission.get');
  const { data: waitingChargeData, refetch: refetchWaitingCharge } = useTrpcQuery<{ config: WaitingChargeConfig }>('admin.pricing.waitingCharge.get');
  const { data: cancellationFeeData, refetch: refetchCancellationFee } = useTrpcQuery<{ config: CancellationFeeConfig }>('admin.pricing.cancellationFee.get');

  const [editingTier, setEditingTier] = useState<TierConfig | null>(null);
  const [editingRule, setEditingRule] = useState<Partial<TrafficRule> | null>(null);
  const [editingPriority, setEditingPriority] = useState<PriorityConfig | null>(null);
  const [editingSurge, setEditingSurge] = useState<SurgeConfig | null>(null);
  const [editingCommission, setEditingCommission] = useState<{ id: string; ratePercent: number } | null>(null);
  const [editingWaitingCharge, setEditingWaitingCharge] = useState<WaitingChargeConfig | null>(null);
  const [editingCancellationFee, setEditingCancellationFee] = useState<CancellationFeeConfig | null>(null);

  const saveTier = async () => {
    if (!editingTier) return;
    await trpcMutate('admin.pricing.tiers.update', editingTier);
    setEditingTier(null);
    refetchTiers();
  };

  const saveRule = async () => {
    if (!editingRule) return;
    if (editingRule.id) {
      await trpcMutate('admin.pricing.trafficRules.update', editingRule);
    } else {
      await trpcMutate('admin.pricing.trafficRules.create', editingRule);
    }
    setEditingRule(null);
    refetchRules();
  };

  const deleteRule = async (id: string) => {
    if (!confirm('Delete this traffic rule? This cannot be undone.')) return;
    await trpcMutate('admin.pricing.trafficRules.delete', { id });
    refetchRules();
  };

  const savePriority = async () => {
    if (!editingPriority) return;
    await trpcMutate('admin.pricing.priority.update', editingPriority);
    setEditingPriority(null);
    refetchPriority();
  };

  const saveSurge = async () => {
    if (!editingSurge) return;
    await trpcMutate('admin.pricing.surge.update', editingSurge);
    setEditingSurge(null);
    refetchSurge();
  };

  const saveCommission = async () => {
    if (!editingCommission) return;
    await trpcMutate('admin.pricing.commission.update', {
      id: editingCommission.id,
      rate: editingCommission.ratePercent / 100,
    });
    setEditingCommission(null);
    refetchCommission();
  };

  const saveWaitingCharge = async () => {
    if (!editingWaitingCharge) return;
    await trpcMutate('admin.pricing.waitingCharge.update', editingWaitingCharge);
    setEditingWaitingCharge(null);
    refetchWaitingCharge();
  };

  const saveCancellationFee = async () => {
    if (!editingCancellationFee) return;
    await trpcMutate('admin.pricing.cancellationFee.update', editingCancellationFee);
    setEditingCancellationFee(null);
    refetchCancellationFee();
  };

  const tierColumns: TableColumn<TierConfig>[] = [
    { key: 'name', header: 'Tier', render: (t) => <span className="font-medium text-slate-900">{t.name}</span> },
    { key: 'base', header: 'Base', align: 'right', render: (t) => <span className="tnum text-slate-700">₦{t.base.toLocaleString()}</span> },
    { key: 'perKm', header: 'Per km', align: 'right', render: (t) => <span className="tnum text-slate-700">₦{t.perKm.toLocaleString()}</span> },
    { key: 'perMin', header: 'Per min', align: 'right', render: (t) => <span className="tnum text-slate-700">₦{t.perMin.toLocaleString()}</span> },
    { key: 'minFare', header: 'Min fare', align: 'right', render: (t) => <span className="tnum text-slate-700">₦{t.minFare.toLocaleString()}</span> },
    { key: 'bookingFee', header: 'Booking fee', align: 'right', render: (t) => <span className="tnum text-slate-700">₦{t.bookingFee.toLocaleString()}</span> },
    { key: 'serviceFee', header: 'Service fee', align: 'right', render: (t) => <span className="tnum text-slate-700">₦{t.serviceFee.toLocaleString()}</span> },
    {
      key: 'edit',
      header: '',
      render: (t) => (
        <button onClick={() => setEditingTier(t)} className="rounded-md p-1.5 hover:bg-slate-100">
          <Pencil size={14} className="text-slate-500" />
        </button>
      ),
    },
  ];

  const ruleColumns: TableColumn<TrafficRule>[] = [
    { key: 'label', header: 'Label', render: (r) => <span className="font-medium text-slate-900">{r.label}</span> },
    {
      key: 'days',
      header: 'Days',
      render: (r) => <span className="text-slate-500">{r.daysOfWeek && r.daysOfWeek.length > 0 ? r.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ') : 'Every day'}</span>,
    },
    {
      key: 'window',
      header: 'Window',
      render: (r) => <span className="text-slate-500">{r.startMinute != null && r.endMinute != null ? `${minutesToTime(r.startMinute)}–${minutesToTime(r.endMinute)}` : 'All day'}</span>,
    },
    { key: 'multiplier', header: 'Multiplier', align: 'right', render: (r) => <span className="tnum text-slate-700">×{r.multiplier}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusLabel tone={r.isEnabled ? 'success' : 'neutral'}>{r.isEnabled ? 'enabled' : 'disabled'}</StatusLabel> },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex gap-1">
          <button onClick={() => setEditingRule(r)} className="rounded-md p-1.5 hover:bg-slate-100">
            <Pencil size={14} className="text-slate-500" />
          </button>
          <button onClick={() => deleteRule(r.id)} className="rounded-md p-1.5 hover:bg-danger-tint">
            <Trash2 size={14} className="text-danger" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader title="Pricing" description="Live, platform-wide fare configuration — changes take effect immediately." />

      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Tier rates</h2>
        <Table columns={tierColumns} rows={tiersData?.tiers ?? []} rowKey={(t) => t.id} loading={tiersLoading} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">Traffic multiplier rules</h2>
          <Button size="sm" variant="secondary" onClick={() => setEditingRule({ label: '', multiplier: 1, isEnabled: true, daysOfWeek: [] })}>
            <Plus size={13} />
            New rule
          </Button>
        </div>
        {rulesLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (rulesData?.rules ?? []).length === 0 ? (
          <EmptyState title="No traffic rules" description="Create one to apply time-based fare multipliers." />
        ) : (
          <Table columns={ruleColumns} rows={rulesData?.rules ?? []} rowKey={(r) => r.id} />
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Priority fee</h2>
          {priorityData?.config && (
            <ConfigCard onEdit={() => setEditingPriority(priorityData.config)}>
              <p className="tnum text-lg font-semibold text-slate-900">₦{priorityData.config.fee.toLocaleString()}</p>
              <StatusLabel tone={priorityData.config.isEnabled ? 'success' : 'neutral'}>{priorityData.config.isEnabled ? 'enabled' : 'disabled'}</StatusLabel>
            </ConfigCard>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Surge config</h2>
          {surgeData?.config && (
            <ConfigCard onEdit={() => setEditingSurge(surgeData.config)}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                <span>Min ×{surgeData.config.minMultiplier}</span>
                <span>Max ×{surgeData.config.maxMultiplier}</span>
                <span>High demand {surgeData.config.highDemandRatio}</span>
                <span>Low demand {surgeData.config.lowDemandRatio}</span>
              </div>
              <div className="mt-2">
                <StatusLabel tone={surgeData.config.isEnabled ? 'success' : 'neutral'}>{surgeData.config.isEnabled ? 'enabled' : 'disabled'}</StatusLabel>
              </div>
            </ConfigCard>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Commission rate</h2>
          {commissionData?.config && (
            <ConfigCard onEdit={() => setEditingCommission({ id: commissionData.config.id, ratePercent: commissionData.config.rate * 100 })}>
              <p className="tnum text-lg font-semibold text-slate-900">{(commissionData.config.rate * 100).toFixed(1)}%</p>
            </ConfigCard>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Waiting charge</h2>
          {waitingChargeData?.config && (
            <ConfigCard onEdit={() => setEditingWaitingCharge(waitingChargeData.config)}>
              <div className="text-xs text-slate-600">
                <p>{waitingChargeData.config.graceMinutes} min grace</p>
                <p className="tnum">₦{waitingChargeData.config.perMinuteRate.toLocaleString()}/min after</p>
              </div>
            </ConfigCard>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Cancellation fee</h2>
          {cancellationFeeData?.config && (
            <ConfigCard onEdit={() => setEditingCancellationFee(cancellationFeeData.config)}>
              <div className="text-xs text-slate-600">
                <p>{cancellationFeeData.config.freeWindowSeconds}s free window</p>
                <p className="tnum">₦{cancellationFeeData.config.afterAcceptFee.toLocaleString()} after accept</p>
                <p className="tnum">₦{cancellationFeeData.config.afterArrivalFee.toLocaleString()} after arrival</p>
              </div>
            </ConfigCard>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Not yet configurable</h2>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          Airport zone fees have no consumer yet — nothing in the app applies them to a ride, so there's nothing to make
          admin-editable until that logic is built. Everything else on this page is now live.
        </div>
      </section>

      {editingTier && (
        <Modal title={`Edit ${editingTier.name} tier`} width="md" onClose={() => setEditingTier(null)} footer={<ModalFooter onCancel={() => setEditingTier(null)} onSave={saveTier} />}>
          <NumberField label="Base fare" value={editingTier.base} onChange={(n) => setEditingTier({ ...editingTier, base: n })} />
          <NumberField label="Per km" value={editingTier.perKm} onChange={(n) => setEditingTier({ ...editingTier, perKm: n })} />
          <NumberField label="Per min" value={editingTier.perMin} onChange={(n) => setEditingTier({ ...editingTier, perMin: n })} />
          <NumberField label="Minimum fare" value={editingTier.minFare} onChange={(n) => setEditingTier({ ...editingTier, minFare: n })} />
          <NumberField label="Booking fee" value={editingTier.bookingFee} onChange={(n) => setEditingTier({ ...editingTier, bookingFee: n })} />
          <NumberField label="Service fee" value={editingTier.serviceFee} onChange={(n) => setEditingTier({ ...editingTier, serviceFee: n })} />
        </Modal>
      )}

      {editingRule && (
        <Modal
          title={editingRule.id ? 'Edit traffic rule' : 'New traffic rule'}
          width="md"
          onClose={() => setEditingRule(null)}
          footer={<ModalFooter onCancel={() => setEditingRule(null)} onSave={saveRule} />}
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Label</span>
            <input
              value={editingRule.label ?? ''}
              onChange={(e) => setEditingRule({ ...editingRule, label: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-500">Days (none = every day)</span>
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((label, i) => {
                const active = (editingRule.daysOfWeek ?? []).includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const days = new Set(editingRule.daysOfWeek ?? []);
                      if (active) days.delete(i);
                      else days.add(i);
                      setEditingRule({ ...editingRule, daysOfWeek: Array.from(days).sort() });
                    }}
                    className={`rounded-md px-2 py-1 text-xs font-medium ${active ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Start time</span>
              <input
                type="time"
                value={minutesToTime(editingRule.startMinute ?? null)}
                onChange={(e) => setEditingRule({ ...editingRule, startMinute: timeToMinutes(e.target.value) })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">End time</span>
              <input
                type="time"
                value={minutesToTime(editingRule.endMinute ?? null)}
                onChange={(e) => setEditingRule({ ...editingRule, endMinute: timeToMinutes(e.target.value) })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          </div>
          <NumberField label="Multiplier" step={0.05} value={editingRule.multiplier ?? 1} onChange={(n) => setEditingRule({ ...editingRule, multiplier: n })} />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={editingRule.isEnabled ?? true} onChange={(e) => setEditingRule({ ...editingRule, isEnabled: e.target.checked })} />
            Enabled
          </label>
        </Modal>
      )}

      {editingPriority && (
        <Modal title="Edit priority fee" width="md" onClose={() => setEditingPriority(null)} footer={<ModalFooter onCancel={() => setEditingPriority(null)} onSave={savePriority} />}>
          <NumberField label="Fee" value={editingPriority.fee} onChange={(n) => setEditingPriority({ ...editingPriority, fee: n })} />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={editingPriority.isEnabled} onChange={(e) => setEditingPriority({ ...editingPriority, isEnabled: e.target.checked })} />
            Enabled
          </label>
        </Modal>
      )}

      {editingSurge && (
        <Modal title="Edit surge config" width="md" onClose={() => setEditingSurge(null)} footer={<ModalFooter onCancel={() => setEditingSurge(null)} onSave={saveSurge} />}>
          <NumberField step={0.1} label="Min multiplier" value={editingSurge.minMultiplier} onChange={(n) => setEditingSurge({ ...editingSurge, minMultiplier: n })} />
          <NumberField step={0.1} label="Max multiplier" value={editingSurge.maxMultiplier} onChange={(n) => setEditingSurge({ ...editingSurge, maxMultiplier: n })} />
          <NumberField step={0.1} label="High demand ratio" value={editingSurge.highDemandRatio} onChange={(n) => setEditingSurge({ ...editingSurge, highDemandRatio: n })} />
          <NumberField step={0.1} label="Low demand ratio" value={editingSurge.lowDemandRatio} onChange={(n) => setEditingSurge({ ...editingSurge, lowDemandRatio: n })} />
          <NumberField step={0.05} label="Low acceptance threshold" value={editingSurge.lowAcceptanceThreshold} onChange={(n) => setEditingSurge({ ...editingSurge, lowAcceptanceThreshold: n })} />
          <NumberField step={0.05} label="Low acceptance bonus" value={editingSurge.lowAcceptanceBonus} onChange={(n) => setEditingSurge({ ...editingSurge, lowAcceptanceBonus: n })} />
          <NumberField label="Acceptance lookback (min)" value={editingSurge.acceptanceLookbackMinutes} onChange={(n) => setEditingSurge({ ...editingSurge, acceptanceLookbackMinutes: n })} />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={editingSurge.isEnabled} onChange={(e) => setEditingSurge({ ...editingSurge, isEnabled: e.target.checked })} />
            Enabled
          </label>
        </Modal>
      )}

      {editingCommission && (
        <Modal title="Edit commission rate" width="md" onClose={() => setEditingCommission(null)} footer={<ModalFooter onCancel={() => setEditingCommission(null)} onSave={saveCommission} />}>
          <NumberField step={0.5} label="Rate (%)" value={editingCommission.ratePercent} onChange={(n) => setEditingCommission({ ...editingCommission, ratePercent: n })} />
        </Modal>
      )}

      {editingWaitingCharge && (
        <Modal title="Edit waiting charge" width="md" onClose={() => setEditingWaitingCharge(null)} footer={<ModalFooter onCancel={() => setEditingWaitingCharge(null)} onSave={saveWaitingCharge} />}>
          <NumberField label="Grace period (minutes)" value={editingWaitingCharge.graceMinutes} onChange={(n) => setEditingWaitingCharge({ ...editingWaitingCharge, graceMinutes: n })} />
          <NumberField label="Rate per minute (₦)" value={editingWaitingCharge.perMinuteRate} onChange={(n) => setEditingWaitingCharge({ ...editingWaitingCharge, perMinuteRate: n })} />
        </Modal>
      )}

      {editingCancellationFee && (
        <Modal
          title="Edit cancellation fee"
          width="md"
          onClose={() => setEditingCancellationFee(null)}
          footer={<ModalFooter onCancel={() => setEditingCancellationFee(null)} onSave={saveCancellationFee} />}
        >
          <NumberField label="Free window (seconds)" value={editingCancellationFee.freeWindowSeconds} onChange={(n) => setEditingCancellationFee({ ...editingCancellationFee, freeWindowSeconds: n })} />
          <NumberField label="Fee after driver accepts (₦)" value={editingCancellationFee.afterAcceptFee} onChange={(n) => setEditingCancellationFee({ ...editingCancellationFee, afterAcceptFee: n })} />
          <NumberField label="Fee after driver arrives (₦)" value={editingCancellationFee.afterArrivalFee} onChange={(n) => setEditingCancellationFee({ ...editingCancellationFee, afterArrivalFee: n })} />
        </Modal>
      )}
    </div>
  );
}
