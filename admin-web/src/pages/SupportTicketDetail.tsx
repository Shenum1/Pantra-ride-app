import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { trpcMutate } from '../lib/api';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { StatusLabel } from '../components/ui/StatusLabel';
import { Button } from '../components/ui/Button';
import { ticketStatusTone, ticketPriorityTone } from '../lib/status';

interface TicketDetailData {
  ticket: {
    id: string;
    filedByRole: 'rider' | 'driver';
    filedByName: string | null;
    subject: string;
    category: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    createdAt: string;
  };
  messages: { id: string; senderType: 'user' | 'driver' | 'admin'; text: string; createdAt: string }[];
  events: { id: string; actorType: string; eventType: string; fromStatus: string | null; toStatus: string | null; reason: string | null; createdAt: string }[];
}

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export default function SupportTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, refetch } = useTrpcQuery<TicketDetailData>('admin.support.getDetail', { ticketId: id }, [id]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const sendReply = async () => {
    if (!id || !reply.trim()) return;
    setSending(true);
    try {
      await trpcMutate('admin.support.reply', { ticketId: id, text: reply.trim() });
      setReply('');
      refetch();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (status: string) => {
    if (!id) return;
    await trpcMutate('admin.support.updateStatus', { ticketId: id, status });
    refetch();
  };

  const updatePriority = async (priority: string) => {
    if (!id) return;
    await trpcMutate('admin.support.updateStatus', { ticketId: id, priority });
    refetch();
  };

  if (loading) return <p className="text-sm text-slate-400">Loading ticket…</p>;
  if (error || !data) {
    return <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{error || 'Ticket not found.'}</div>;
  }

  const { ticket, messages } = data;

  return (
    <div className="max-w-3xl space-y-6">
      <Link to="/support" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} />
        Support
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {ticket.filedByName || '—'} <span className="capitalize">({ticket.filedByRole})</span> · <span className="capitalize">{ticket.category.replace(/_/g, ' ')}</span> · {new Date(ticket.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={ticket.status}
            onChange={(e) => updateStatus(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium capitalize focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select
            value={ticket.priority}
            onChange={(e) => updatePriority(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium capitalize focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <StatusLabel tone={ticketStatusTone[ticket.status]}>{ticket.status.replace(/_/g, ' ')}</StatusLabel>
        <StatusLabel tone={ticketPriorityTone[ticket.priority]}>{ticket.priority}</StatusLabel>
      </div>

<div className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.senderType === 'admin' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] rounded-md px-3 py-2 text-sm ${
                m.senderType === 'admin' ? 'bg-primary-tint text-slate-900' : 'bg-slate-100 text-slate-800'
              }`}
            >
              <p>{m.text}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {m.senderType === 'admin' ? 'Support' : ticket.filedByRole} · {new Date(m.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Reply to this ticket…"
          rows={3}
          className="flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <Button variant="primary" onClick={sendReply} disabled={sending || !reply.trim()}>
          <Send size={14} />
          Send
        </Button>
      </div>
    </div>
  );
}
