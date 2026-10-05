import { useState } from 'react';
import { trpcMutate } from '../lib/api';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { StatusLabel } from '../components/ui/StatusLabel';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterTabs } from '../components/ui/FilterTabs';
import { Table, type TableColumn } from '../components/ui/Table';
import { agentActionStatusTone } from '../lib/status';

type ActionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'EXECUTION_FAILED';

interface AgentAction {
  id: string;
  actionType: string;
  payload: Record<string, unknown>;
  rationale: string;
  beforeSnapshot: Record<string, unknown> | null;
  status: ActionStatus;
  result: unknown;
  error: string | null;
  resolvedByAdminId: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  summary: string;
  irreversible: boolean;
}

interface ActionsResponse {
  actions: AgentAction[];
  total: number;
}

const FILTERS: { value: ActionStatus | 'ALL'; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'EXECUTED', label: 'Executed' },
  { value: 'EXECUTION_FAILED', label: 'Failed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL', label: 'All' },
];

const STATUS_LABEL: Record<ActionStatus, string> = {
  PENDING: 'awaiting approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXECUTED: 'executed',
  EXECUTION_FAILED: 'failed',
};

const LIMIT = 50;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function SnapshotDiff({ action }: { action: AgentAction }) {
  const before = action.beforeSnapshot;
  if (!before || Object.keys(before).length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Current → proposed</p>
      <table className="text-sm">
        <tbody>
          {Object.keys(before).map((key) => {
            const proposed = action.irreversible ? 'deleted' : key in action.payload ? formatValue(action.payload[key]) : '—';
            const changed = action.irreversible || (key in action.payload && formatValue(action.payload[key]) !== formatValue(before[key]));
            return (
              <tr key={key}>
                <td className="py-0.5 pr-6 text-slate-500">{key}</td>
                <td className="tnum py-0.5 pr-4 text-slate-700">{formatValue(before[key])}</td>
                <td className="py-0.5 pr-4 text-slate-300">→</td>
                <td className={`tnum py-0.5 ${changed ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{proposed}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1.5 text-xs text-slate-400">
        Approval is refused automatically if any current value changes before you approve.
      </p>
    </div>
  );
}

function ActionDetail({ action }: { action: AgentAction }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Agent's rationale</p>
        <p className="max-w-3xl text-sm text-slate-700">{action.rationale}</p>
      </div>

      <SnapshotDiff action={action} />

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Exact payload <span className="font-mono normal-case tracking-normal">{action.actionType}</span>
        </p>
        <pre className="max-w-3xl overflow-x-auto rounded-md border border-slate-200 bg-white p-3 font-mono text-xs text-slate-700">
          {JSON.stringify(action.payload, null, 2)}
        </pre>
      </div>

      {action.status === 'EXECUTION_FAILED' && action.error && (
        <div className="max-w-3xl rounded-md border border-danger/20 bg-danger-tint px-3 py-2 text-sm text-danger">
          Not applied: {action.error}
        </div>
      )}

      {action.status === 'EXECUTED' && action.result != null && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Result</p>
          <pre className="max-w-3xl overflow-x-auto font-mono text-xs text-slate-600">{JSON.stringify(action.result, null, 2)}</pre>
        </div>
      )}

      {action.resolvedAt && (
        <p className="text-xs text-slate-400">
          {action.status === 'REJECTED' ? 'Rejected' : 'Approved'} {new Date(action.resolvedAt).toLocaleString()}
          {action.resolutionNote ? ` — "${action.resolutionNote}"` : ''}
        </p>
      )}
    </div>
  );
}

export default function AgentQueue() {
  const [filter, setFilter] = useState<ActionStatus | 'ALL'>('PENDING');
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolving, setResolving] = useState<{ action: AgentAction; decision: 'APPROVED' | 'REJECTED' } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null);

  const { data, loading, error, refetch } = useTrpcQuery<ActionsResponse>(
    'admin.agentActions.list',
    { status: filter === 'ALL' ? undefined : filter, limit: LIMIT, offset },
    [filter, offset]
  );

  const actions = data?.actions ?? [];
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + LIMIT, total);

  const resolve = async (note?: string) => {
    if (!resolving) return;
    setProcessing(true);
    try {
      const { action } = await trpcMutate<{ action: AgentAction }>('admin.agentActions.resolve', {
        id: resolving.action.id,
        decision: resolving.decision,
        note,
      });
      if (action.status === 'EXECUTED') setOutcome({ ok: true, message: `Applied: ${resolving.action.summary}` });
      else if (action.status === 'REJECTED') setOutcome({ ok: true, message: `Rejected: ${resolving.action.summary}` });
      else setOutcome({ ok: false, message: `Approved but NOT applied: ${action.error ?? 'execution failed.'}` });
      refetch();
    } catch (e) {
      setOutcome({ ok: false, message: (e as Error).message });
      refetch();
    } finally {
      setProcessing(false);
      setResolving(null);
    }
  };

  const columns: TableColumn<AgentAction>[] = [
    {
      key: 'proposed',
      header: 'Proposed change',
      render: (a) => (
        <div className="max-w-[460px]">
          <p className="truncate font-medium text-slate-900">{a.summary}</p>
          <p className="font-mono text-xs text-slate-400">
            {a.actionType}
            {a.irreversible && <span className="ml-2 font-sans font-semibold text-danger">cannot be undone</span>}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (a) => <StatusLabel tone={agentActionStatusTone[a.status] ?? 'neutral'}>{STATUS_LABEL[a.status] ?? a.status}</StatusLabel>,
    },
    {
      key: 'created',
      header: 'Proposed',
      render: (a) => <span className="whitespace-nowrap text-slate-500">{new Date(a.createdAt).toLocaleString()}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (a) =>
        a.status === 'PENDING' ? (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button variant={a.irreversible ? 'danger' : 'success'} size="sm" disabled={processing} onClick={() => setResolving({ action: a, decision: 'APPROVED' })}>
              Approve
            </Button>
            <Button variant="secondary" size="sm" disabled={processing} onClick={() => setResolving({ action: a, decision: 'REJECTED' })}>
              Reject
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent queue"
        description="Changes proposed by the AI admin agent. Nothing takes effect until an admin approves it here."
      />

      <FilterTabs
        options={FILTERS}
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setOffset(0);
          setOutcome(null);
        }}
      />

      {outcome && (
        <div
          className={`flex items-start justify-between gap-4 rounded-md border px-4 py-3 text-sm ${
            outcome.ok ? 'border-success/20 bg-success-tint text-success' : 'border-danger/20 bg-danger-tint text-danger'
          }`}
        >
          <span>{outcome.message}</span>
          <button onClick={() => setOutcome(null)} className="text-xs font-medium opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{error}</div>
      ) : (
        <Table
          columns={columns}
          rows={actions}
          rowKey={(a) => a.id}
          loading={loading}
          countLabel={`${total.toLocaleString()} action${total === 1 ? '' : 's'}`}
          emptyTitle={filter === 'PENDING' ? 'Nothing awaiting approval' : 'No actions'}
          emptyDescription={filter === 'PENDING' ? 'Changes the agent proposes will appear here for review.' : undefined}
          onRowClick={(a) => setExpanded(expanded === a.id ? null : a.id)}
          expandedKey={expanded}
          renderExpanded={(a) => <ActionDetail action={a} />}
          pagination={{ from, to, total, limit: LIMIT, onPrev: () => setOffset((o) => Math.max(0, o - LIMIT)), onNext: () => setOffset((o) => o + LIMIT) }}
        />
      )}

      {resolving && (
        <ConfirmModal
          title={resolving.decision === 'APPROVED' ? 'Approve and apply this change?' : 'Reject this change?'}
          description={
            resolving.decision === 'APPROVED'
              ? `${resolving.action.summary}. ${
                  resolving.action.irreversible ? 'This permanently deletes data and cannot be undone. ' : ''
                }It runs immediately with you recorded as the approving admin.`
              : `${resolving.action.summary}. Nothing will change; the agent will see it was rejected.`
          }
          reasonLabel="Note (optional)"
          reasonPlaceholder={resolving.decision === 'APPROVED' ? 'Anything to record with this approval…' : 'Why it was rejected — the agent can read this…'}
          confirmLabel={resolving.decision === 'APPROVED' ? 'Approve' : 'Reject'}
          confirmVariant={resolving.decision === 'REJECTED' ? 'danger' : resolving.action.irreversible ? 'danger' : 'success'}
          processing={processing}
          onCancel={() => setResolving(null)}
          onConfirm={resolve}
        />
      )}
    </div>
  );
}
