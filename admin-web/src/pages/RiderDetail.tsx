import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { EmptyState } from '../components/ui/EmptyState';

interface RiderDetailData {
  profile: {
    uid: string;
    displayName: string | null;
    email: string | null;
    createdAt: string;
    dateOfBirth: string | null;
    address: string | null;
    rating: number | null;
    totalRatings: number;
  };
  wallet: { balance: number; updatedAt: string } | null;
  savedLocations: { id: string; name: string; address: string; type: 'home' | 'work' | 'favorite' }[];
  familyMembers: { id: string; name: string; relationship: string; phone: string | null }[];
  ratings: { id: string; rideId: string; rating: number; comment: string | null; tags: string[] | null; createdAt: string }[];
}

interface WalletTxRow {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  status: string;
  createdAt: string;
}

interface WalletTxResponse {
  transactions: WalletTxRow[];
  total: number;
}

const LIMIT = 25;

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-800">{value || '—'}</p>
    </div>
  );
}

export default function RiderDetail() {
  const { id } = useParams<{ id: string }>();
  const [offset, setOffset] = useState(0);
  const { data, loading, error } = useTrpcQuery<RiderDetailData>('admin.riders.getDetail', { riderId: id }, [id]);
  const { data: txData, loading: txLoading } = useTrpcQuery<WalletTxResponse>(
    'admin.riders.getWalletTransactions',
    { riderId: id, limit: LIMIT, offset },
    [id, offset]
  );

  if (loading) return <p className="text-sm text-slate-400">Loading rider…</p>;
  if (error || !data) {
    return <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{error || 'Rider not found.'}</div>;
  }

  const { profile, wallet, savedLocations, familyMembers, ratings } = data;
  const total = txData?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + LIMIT, total);

  return (
    <div className="max-w-4xl space-y-8">
      <Link to="/riders" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} />
        Riders
      </Link>

      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900">{profile.displayName || 'Unnamed rider'}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {profile.email || '—'} · {profile.rating ? `${profile.rating.toFixed(1)}★ (${profile.totalRatings})` : 'No rating yet'}
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Profile</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-md border border-slate-200 bg-white p-5 md:grid-cols-3">
          <Field label="Joined" value={new Date(profile.createdAt).toLocaleDateString()} />
          <Field label="Date of birth" value={profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : null} />
          <Field label="Address" value={profile.address} />
          <Field label="Wallet balance" value={wallet ? `₦${wallet.balance.toLocaleString()}` : 'No wallet yet'} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Saved places</h2>
          {savedLocations.length === 0 ? (
            <EmptyState title="No saved places" />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
              {savedLocations.map((l) => (
                <li key={l.id} className="px-4 py-3">
                  <p className="text-sm font-medium capitalize text-slate-800">{l.type} — {l.name}</p>
                  <p className="text-xs text-slate-400">{l.address}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Family &amp; emergency contacts</h2>
          {familyMembers.length === 0 ? (
            <EmptyState title="No contacts added" />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
              {familyMembers.map((f) => (
                <li key={f.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-slate-800">{f.name}</p>
                  <p className="text-xs text-slate-400">{f.relationship}{f.phone ? ` · ${f.phone}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Ratings from drivers</h2>
        {ratings.length === 0 ? (
          <EmptyState title="No ratings yet" />
        ) : (
          <ul className="space-y-2">
            {ratings.map((r) => (
              <li key={r.id} className="rounded-md border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="tnum text-sm font-semibold text-slate-900">{r.rating}★</span>
                  <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                {r.comment && <p className="mt-1 text-sm text-slate-600">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Wallet transactions</h2>
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Type</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Description</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Amount</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : (txData?.transactions ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState title="No wallet activity" />
                  </td>
                </tr>
              ) : (
                (txData?.transactions ?? []).map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 capitalize text-slate-700">{t.type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-slate-500">{t.description || '—'}</td>
                    <td className={`tnum px-4 py-3 text-right font-medium ${t.amount < 0 ? 'text-danger' : 'text-slate-900'}`}>
                      {t.amount < 0 ? '−' : '+'}₦{Math.abs(t.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-500">{t.status}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
      </section>
    </div>
  );
}
