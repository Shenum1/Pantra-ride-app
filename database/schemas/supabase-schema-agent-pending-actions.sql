-- Human-in-the-loop queue for the AI admin agent (backend/agent-admin/).
-- Every write the agent requests lands here as PENDING and does nothing until
-- a real admin (Supabase session + 'admin' role — never the agent's own key)
-- approves it. Approval re-runs the same service function the admin-web uses,
-- against live state at that moment.
--
-- EXECUTION_FAILED is deliberately distinct from EXECUTED: an approved action
-- can still fail when run (e.g. the payout already moved on, or a pricing
-- value changed after the agent proposed its edit), and must never be
-- recorded as having taken effect.
create table if not exists public.agent_pending_actions (
  id uuid primary key default gen_random_uuid(),
  "actionType" text not null,
  payload jsonb not null,
  rationale text not null,
  -- Current values captured when the agent queued the action (config edits
  -- and deletes). Execution is refused if the live values no longer match,
  -- so an admin only ever approves the exact before -> after they were shown.
  "beforeSnapshot" jsonb,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'EXECUTION_FAILED')),
  result jsonb,
  error text,
  "resolvedByAdminId" uuid,
  "resolutionNote" text,
  "resolvedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists agent_pending_actions_status_created_idx
  on public.agent_pending_actions (status, "createdAt" desc);

-- Service-role only: RLS on with no policies means anon/authenticated
-- clients can neither read nor write this table directly.
alter table public.agent_pending_actions enable row level security;
