-- ============================================================
-- Pantra Ride App — Policy Acceptance Records (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema.sql (needs public.users). Safe to re-run.
-- ============================================================

-- One row per (user, policy, version) the user explicitly accepted — the
-- server-side record behind the "I agree" checkbox at signup and the
-- re-acceptance prompt shown when a policy's version is bumped (current
-- versions live in constants/legal-versions.ts). Deliberately minimal: no IP,
-- device ID or other personal data beyond who accepted what, when, and on
-- which platform (ios/android/web).
create table if not exists public.policy_acceptances (
  "id"            uuid primary key default gen_random_uuid(),
  "userId"        uuid not null references public.users("uid") on delete cascade,
  "policyType"    text not null check ("policyType" in ('terms','privacy','driver_terms')),
  "policyVersion" text not null,
  "acceptedAt"    timestamptz not null default now(),
  "platform"      text,
  unique ("userId", "policyType", "policyVersion")
);

create index if not exists idx_policy_acceptances_userId on public.policy_acceptances("userId");

-- RLS: a user can record and read their own acceptances, nothing else.
-- No update/delete policy exists, so (outside the service role) a record can
-- never be changed or withdrawn once written. The insert check also pins
-- "acceptedAt" to the server clock, so a client can't backdate a record —
-- in practice the app never sends it and the column default applies.
alter table public.policy_acceptances enable row level security;

drop policy if exists "Users can read own policy acceptances" on public.policy_acceptances;
create policy "Users can read own policy acceptances"
  on public.policy_acceptances for select using (auth.uid() = "userId");

drop policy if exists "Users can record own policy acceptances" on public.policy_acceptances;
create policy "Users can record own policy acceptances"
  on public.policy_acceptances for insert with check (
    auth.uid() = "userId"
    and "acceptedAt" between now() - interval '5 minutes' and now() + interval '5 minutes'
  );
