-- Password reset audit log: run once in the Supabase SQL editor.
create table if not exists public.password_reset_events (
  "id"        uuid primary key default gen_random_uuid(),
  "userId"    uuid not null references public.users("uid") on delete cascade,
  "method"    text check ("method" in ('email')) not null default 'email',
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_password_reset_events_userId on public.password_reset_events("userId");

alter table public.password_reset_events enable row level security;

create policy "Users manage own password reset events"
  on public.password_reset_events for all
  using (auth.uid() = "userId")
  with check (auth.uid() = "userId");
