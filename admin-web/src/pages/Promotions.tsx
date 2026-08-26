import { useState } from 'react';
import { Plus, Ticket } from 'lucide-react';
import { trpcMutate } from '../lib/api';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { TableSkeleton } from '../components/ui/Skeleton';

interface Promotion {
  id: string;
  code: string;
  description: string;
  discountPercentage: number;
  maxDiscountNGN: number | null;
  maxUses: number | null;
  usedCount: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  createdAt: string;
}

interface PromotionsResponse {
  promotions: Promotion[];
  total: number;
}

interface UsageRow {
  id: string;
  userId: string;
  userName: string;
  rideId: string | null;
  usedAt: string;
}

interface UsageResponse {
  uses: UsageRow[];
  total: number;
}

type PromoForm = {
  id?: string;
  code: string;
  description: string;
  discountPercentage: number;
  maxDiscountNGN?: number;
  maxUses?: number;
  validUntil: string;
  isActive: boolean;
};

function isExpired(validUntil: string) {
  return new Date(validUntil).getTime() < Date.now();
}

export default function Promotions() {
  const { data, loading, error, refetch } = useTrpcQuery<PromotionsResponse>('admin.promotions.list');
  const [editing, setEditing] = useState<PromoForm | null>(null);
  const [usageFor, setUsageFor] = useState<Promotion | null>(null);

  const save = async () => {
    if (!editing) return;
    if (editing.id) {
      await trpcMutate('admin.promotions.update', editing);
    } else {
      await trpcMutate('admin.promotions.create', editing);
    }
    setEditing(null);
    refetch();
  };

  const toggleActive = async (p: Promotion) => {
    await trpcMutate('admin.promotions.update', { id: p.id, isActive: !p.isActive });
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Promotions</h1>
          <p className="mt-1 text-sm text-slate-500">Promo codes are deactivated, never deleted — redemption history is kept.</p>
        </div>
        <Button
          size="sm"
          onClick={() =>
            setEditing({ code: '', description: '', discountPercentage: 10, validUntil: '', isActive: true })
          }
        >
          <Plus size={14} />
          New code
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Code</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Description</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Discount</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Uses</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Valid until</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <TableSkeleton rows={5} cols={7} />
                ) : (data?.promotions ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <EmptyState title="No promo codes yet" description="Create one to offer riders a discount." />
                    </td>
                  </tr>
                ) : (
                  (data?.promotions ?? []).map((p) => {
                    const expired = isExpired(p.validUntil);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">{p.code}</td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-slate-600">{p.description}</td>
                        <td className="tnum px-4 py-3 text-right text-slate-700">
                          {p.discountPercentage}%{p.maxDiscountNGN ? ` (max ₦${p.maxDiscountNGN.toLocaleString()})` : ''}
                        </td>
                        <td className="tnum px-4 py-3 text-right text-slate-700">
                          <button onClick={() => setUsageFor(p)} className="underline-offset-2 hover:underline">
                            {p.usedCount}{p.maxUses ? ` / ${p.maxUses}` : ''}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{new Date(p.validUntil).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <Badge tone={!p.isActive ? 'neutral' : expired ? 'warning' : 'success'}>
                            {!p.isActive ? 'inactive' : expired ? 'expired' : 'active'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                setEditing({
                                  id: p.id,
                                  code: p.code,
                                  description: p.description,
                                  discountPercentage: p.discountPercentage,
                                  maxDiscountNGN: p.maxDiscountNGN ?? undefined,
                                  maxUses: p.maxUses ?? undefined,
                                  validUntil: p.validUntil.slice(0, 10),
                                  isActive: p.isActive,
                                })
                              }
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              Edit
                            </button>
                            <button onClick={() => toggleActive(p)} className="text-xs font-medium text-slate-500 hover:underline">
                              {p.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-md bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">{editing.id ? 'Edit promo code' : 'New promo code'}</h3>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Code</span>
                <input
                  disabled={!!editing.id}
                  value={editing.code}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Description</span>
                <input
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Discount %</span>
                  <input
                    type="number"
                    value={editing.discountPercentage}
                    onChange={(e) => setEditing({ ...editing, discountPercentage: Number(e.target.value) })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Max discount (₦)</span>
                  <input
                    type="number"
                    value={editing.maxDiscountNGN ?? ''}
                    placeholder="Uncapped"
                    onChange={(e) => setEditing({ ...editing, maxDiscountNGN: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Max uses</span>
                  <input
                    type="number"
                    value={editing.maxUses ?? ''}
                    placeholder="Unlimited"
                    onChange={(e) => setEditing({ ...editing, maxUses: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Valid until</span>
                  <input
                    type="date"
                    value={editing.validUntil}
                    onChange={(e) => setEditing({ ...editing, validUntil: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editing.isActive}
                  onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                />
                Active
              </label>
            </div>
            <div className="mt-5 flex gap-2.5">
              <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" onClick={save} disabled={!editing.code || !editing.description || !editing.validUntil}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {usageFor && <UsageDrawer promo={usageFor} onClose={() => setUsageFor(null)} />}
    </div>
  );
}

function UsageDrawer({ promo, onClose }: { promo: Promotion; onClose: () => void }) {
  const { data, loading } = useTrpcQuery<UsageResponse>('admin.promotions.usage', { promoId: promo.id, limit: 100, offset: 0 }, [promo.id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Ticket size={15} />
            {promo.code} — redemptions
          </h3>
          <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-700">
            Close
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (data?.uses ?? []).length === 0 ? (
          <EmptyState title="No redemptions yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {(data?.uses ?? []).map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-slate-700">{u.userName}</span>
                <span className="text-xs text-slate-400">{new Date(u.usedAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
