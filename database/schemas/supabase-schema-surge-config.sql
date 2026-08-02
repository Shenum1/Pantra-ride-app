-- ============================================================
-- Pantra Ride App — Surge Config Schema (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql (does not touch
-- existing tables/policies).
-- ============================================================

-- Single-row config table (one market). Live driver/ride counts are read
-- directly from public.drivers.isOnline and public.rides.status='pending' —
-- no separate demand/supply tracking table or background job needed; the
-- multiplier is computed client-side on demand via lib/surge-calculator.ts.
create table if not exists public.surge_config (
  "id"              uuid primary key default gen_random_uuid(),
  "minMultiplier"   numeric default 1.0,
  "maxMultiplier"   numeric default 2.5,
  "highDemandRatio" numeric default 1.5,
  "lowDemandRatio"  numeric default 0.3,
  "isEnabled"       boolean default true,
  "updatedAt"       timestamptz default now()
);

alter table public.surge_config enable row level security;

-- Readable by anyone (needed client-side to compute the estimate); writes
-- are admin/service-role only (no client-facing insert/update policy).
drop policy if exists "Anyone can read surge config" on public.surge_config;
create policy "Anyone can read surge config"
  on public.surge_config for select using (true);

insert into public.surge_config ("minMultiplier", "maxMultiplier", "highDemandRatio", "lowDemandRatio", "isEnabled")
select 1.0, 2.5, 1.5, 0.3, true
where not exists (select 1 from public.surge_config);
