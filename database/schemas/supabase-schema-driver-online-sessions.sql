-- ============================================================
-- Pantra Ride App — Driver Online Sessions Schema (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql (does not touch
-- existing tables/policies).
--
-- Tracks continuous online shifts (manual online/offline toggle),
-- separate from drivers.isOnline which also flips true/false while
-- mid-ride (busy vs available for new pickups). Used to compute a
-- real DriverStats.onlineHours instead of a hardcoded number.
-- ============================================================

create table if not exists public.driver_online_sessions (
  "id"        uuid primary key default gen_random_uuid(),
  "driverId"  uuid references public.drivers("id") on delete cascade,
  "startedAt" timestamptz default now(),
  "endedAt"   timestamptz
);

create index if not exists idx_driver_online_sessions_driverId on public.driver_online_sessions("driverId");

alter table public.driver_online_sessions enable row level security;

create policy "Drivers can read their own online sessions"
  on public.driver_online_sessions for select using (
    "driverId" in (select "id" from public.drivers where "userId" = auth.uid())
  );

create policy "Drivers can start their own online sessions"
  on public.driver_online_sessions for insert with check (
    "driverId" in (select "id" from public.drivers where "userId" = auth.uid())
  );

create policy "Drivers can close their own online sessions"
  on public.driver_online_sessions for update using (
    "driverId" in (select "id" from public.drivers where "userId" = auth.uid())
  ) with check (
    "driverId" in (select "id" from public.drivers where "userId" = auth.uid())
  );
