import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { trpcMutate } from '../lib/api';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { StatusLabel } from '../components/ui/StatusLabel';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Table, type TableColumn } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';

type ScreenKey =
  | 'splash'
  | 'role_selection'
  | 'rider_login'
  | 'rider_signup'
  | 'driver_login'
  | 'driver_signup'
  | 'forgot_password'
  | 'driver_dashboard';

interface VideoRow {
  id: string;
  screenKey: ScreenKey;
  videoUrl: string;
  isEnabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface VideosResponse {
  videos: VideoRow[];
}

// Display order follows the user's actual path through the app, not the
// alphabetical order the backend returns rows in.
const SCREENS: { key: ScreenKey; label: string; hint: string }[] = [
  { key: 'splash', label: 'Splash / startup', hint: 'First screen on cold launch, before auth resolves.' },
  { key: 'role_selection', label: 'Role selection', hint: 'Choosing rider vs. driver.' },
  { key: 'rider_login', label: 'Rider login', hint: '' },
  { key: 'rider_signup', label: 'Rider signup', hint: '' },
  { key: 'driver_login', label: 'Driver login', hint: '' },
  { key: 'driver_signup', label: 'Driver signup', hint: '' },
  { key: 'forgot_password', label: 'Forgot password', hint: '' },
  { key: 'driver_dashboard', label: 'Driver dashboard', hint: 'Random pick each load if more than one is enabled here.' },
];

type VideoForm = { id?: string; screenKey: ScreenKey; videoUrl: string; isEnabled: boolean; sortOrder: number };

export default function Content() {
  const { data, loading, error, refetch } = useTrpcQuery<VideosResponse>('admin.videoConfig.list');
  const [editing, setEditing] = useState<VideoForm | null>(null);
  const [saving, setSaving] = useState(false);

  const byScreen = useMemo(() => {
    const map = new Map<ScreenKey, VideoRow[]>();
    for (const row of data?.videos ?? []) {
      const list = map.get(row.screenKey) ?? [];
      list.push(row);
      map.set(row.screenKey, list);
    }
    return map;
  }, [data]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id) {
        await trpcMutate('admin.videoConfig.update', {
          id: editing.id,
          videoUrl: editing.videoUrl,
          isEnabled: editing.isEnabled,
          sortOrder: editing.sortOrder,
        });
      } else {
        await trpcMutate('admin.videoConfig.create', {
          screenKey: editing.screenKey,
          videoUrl: editing.videoUrl,
          isEnabled: editing.isEnabled,
          sortOrder: editing.sortOrder,
        });
      }
      setEditing(null);
      refetch();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: VideoRow) => {
    if (!confirm('Remove this video? This cannot be undone.')) return;
    try {
      await trpcMutate('admin.videoConfig.delete', { id: row.id });
      refetch();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const columns: TableColumn<VideoRow>[] = [
    { key: 'url', header: 'Video URL', render: (r) => <span className="block max-w-[520px] truncate font-mono text-xs text-slate-700">{r.videoUrl}</span> },
    { key: 'order', header: 'Order', align: 'right', render: (r) => <span className="tnum text-slate-500">{r.sortOrder}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusLabel tone={r.isEnabled ? 'success' : 'neutral'}>{r.isEnabled ? 'enabled' : 'disabled'}</StatusLabel> },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex gap-1">
          <button
            onClick={() => setEditing({ id: r.id, screenKey: r.screenKey, videoUrl: r.videoUrl, isEnabled: r.isEnabled, sortOrder: r.sortOrder })}
            className="rounded-md p-1.5 hover:bg-slate-100"
          >
            <Pencil size={14} className="text-slate-500" />
          </button>
          <button onClick={() => remove(r)} className="rounded-md p-1.5 hover:bg-danger-tint">
            <Trash2 size={14} className="text-danger" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader title="Content" description="Background videos shown on the app's splash, auth, and driver-dashboard screens." />

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{error}</div>
      ) : (
        SCREENS.map((screen) => {
          const rows = byScreen.get(screen.key) ?? [];
          return (
            <section key={screen.key}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">{screen.label}</h2>
                  {screen.hint && <p className="mt-0.5 text-xs text-slate-400">{screen.hint}</p>}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditing({ screenKey: screen.key, videoUrl: '', isEnabled: true, sortOrder: rows.length })}
                >
                  <Plus size={13} />
                  Add video
                </Button>
              </div>
              {loading ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : rows.length === 0 ? (
                <EmptyState title="No videos configured" description="The app falls back to its bundled default for this screen." />
              ) : (
                <Table columns={columns} rows={rows} rowKey={(r) => r.id} />
              )}
            </section>
          );
        })
      )}

      {editing && (
        <Modal
          title={editing.id ? 'Edit video' : 'Add video'}
          width="md"
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" onClick={save} disabled={saving || !editing.videoUrl}>
                Save
              </Button>
            </>
          }
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Video URL</span>
            <input
              value={editing.videoUrl}
              onChange={(e) => setEditing({ ...editing, videoUrl: e.target.value })}
              placeholder="https://…"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Order</span>
            <input
              type="number"
              value={editing.sortOrder}
              onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={editing.isEnabled} onChange={(e) => setEditing({ ...editing, isEnabled: e.target.checked })} />
            Enabled
          </label>
        </Modal>
      )}
    </div>
  );
}
