-- Support ticketing: a rider or driver files a ticket, admins reply and change
-- its status. Modeled on the existing conversations/messages thread shape and
-- the driver_verification_audit_log append-only event pattern already used
-- elsewhere in this schema — see supabase-schema.sql (conversations/messages)
-- and supabase-schema-driver-verification-v2.sql (driver_verification_audit_log).

create table if not exists public.support_tickets (
  "id"              uuid primary key default gen_random_uuid(),
  "filedByUserId"   uuid not null references public.users("uid") on delete cascade,
  "filedByRole"     text check ("filedByRole" in ('rider','driver')) not null,
  "filedByName"     text,
  "driverId"        uuid references public.drivers("id"),
  "rideId"          uuid references public.rides("id"),
  "subject"         text not null,
  "category"        text check ("category" in ('ride_issue','payment_issue','account_issue','safety','other')) not null default 'other',
  "status"          text check ("status" in ('open','in_progress','resolved','closed')) not null default 'open',
  "priority"        text check ("priority" in ('low','normal','high','urgent')) not null default 'normal',
  "assignedAdminId" uuid,
  "createdAt"       timestamptz not null default now(),
  "updatedAt"       timestamptz not null default now()
);

create index if not exists idx_support_tickets_filedByUserId on public.support_tickets("filedByUserId");
create index if not exists idx_support_tickets_status on public.support_tickets("status");
create index if not exists idx_support_tickets_createdAt on public.support_tickets("createdAt" desc);

alter table public.support_tickets enable row level security;

drop policy if exists "Users can read own tickets" on public.support_tickets;
create policy "Users can read own tickets"
  on public.support_tickets for select using (auth.uid() = "filedByUserId");

-- Deliberately no insert/update/delete policy for the filer — ticket creation,
-- status/priority changes, and assignment all go through the service-role
-- backend (support.createTicket / admin.support.*), which validates the
-- caller server-side rather than trusting a client-supplied filedByUserId.

create table if not exists public.support_ticket_messages (
  "id"         uuid primary key default gen_random_uuid(),
  "ticketId"   uuid not null references public.support_tickets("id") on delete cascade,
  "senderType" text check ("senderType" in ('user','driver','admin')) not null,
  "senderId"   uuid,
  "text"       text not null,
  "createdAt"  timestamptz not null default now()
);

create index if not exists idx_support_ticket_messages_ticketId on public.support_ticket_messages("ticketId");

alter table public.support_ticket_messages enable row level security;

drop policy if exists "Users can read messages on own tickets" on public.support_ticket_messages;
create policy "Users can read messages on own tickets"
  on public.support_ticket_messages for select using (
    "ticketId" in (select "id" from public.support_tickets where "filedByUserId" = auth.uid())
  );

-- Append-only audit trail, same shape/RLS convention as
-- driver_verification_audit_log: read-only for the ticket's filer, no write
-- policy at all — only the service-role backend ever inserts here.
create table if not exists public.support_ticket_events (
  "id"         uuid primary key default gen_random_uuid(),
  "ticketId"   uuid not null references public.support_tickets("id") on delete cascade,
  "actorType"  text check ("actorType" in ('system','admin','user','driver')) not null,
  "actorId"    uuid,
  "eventType"  text check ("eventType" in ('CREATED','STATUS_CHANGED','PRIORITY_CHANGED','ASSIGNED','MESSAGE_SENT')) not null,
  "fromStatus" text,
  "toStatus"   text,
  "reason"     text,
  "metadata"   jsonb,
  "createdAt"  timestamptz not null default now()
);

create index if not exists idx_support_ticket_events_ticketId on public.support_ticket_events("ticketId");

alter table public.support_ticket_events enable row level security;

drop policy if exists "Users can read events on own tickets" on public.support_ticket_events;
create policy "Users can read events on own tickets"
  on public.support_ticket_events for select using (
    "ticketId" in (select "id" from public.support_tickets where "filedByUserId" = auth.uid())
  );
