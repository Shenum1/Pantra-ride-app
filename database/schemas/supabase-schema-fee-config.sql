-- ============================================================
-- Pantra Ride App — Admin-Configurable Waiting Charge & Cancellation Fee (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql,
-- supabase-schema-ride-waiting-charge.sql, supabase-schema-cancellation-fees.sql
-- (adds two new single-row config tables only; does not touch rides).
-- ============================================================

-- Mirrors pricing_priority_config's shape/RLS convention (open read, no
-- write policy — only the service-role admin routes can write). The client
-- (hooks/useRideStore.ts) fetches this directly and merges it over
-- WAITING_CHARGE_CONFIG in lib/pricing-config.ts, exactly like it already
-- does for pricing_tier_config over TIER_RATES.
create table if not exists public.waiting_charge_config (
  "id"             uuid primary key default gen_random_uuid(),
  "graceMinutes"   numeric not null default 3,
  "perMinuteRate"  numeric not null default 40,
  "updatedAt"      timestamptz default now()
);

alter table public.waiting_charge_config enable row level security;

drop policy if exists "Anyone can read waiting charge config" on public.waiting_charge_config;
create policy "Anyone can read waiting charge config"
  on public.waiting_charge_config for select using (true);

insert into public.waiting_charge_config ("graceMinutes", "perMinuteRate")
select 3, 40
where not exists (select 1 from public.waiting_charge_config);

-- Same pattern for cancellation fees — merged over CANCELLATION_FEE_CONFIG.
create table if not exists public.cancellation_fee_config (
  "id"                uuid primary key default gen_random_uuid(),
  "freeWindowSeconds" numeric not null default 60,
  "afterAcceptFee"    numeric not null default 200,
  "afterArrivalFee"   numeric not null default 500,
  "updatedAt"         timestamptz default now()
);

alter table public.cancellation_fee_config enable row level security;

drop policy if exists "Anyone can read cancellation fee config" on public.cancellation_fee_config;
create policy "Anyone can read cancellation fee config"
  on public.cancellation_fee_config for select using (true);

insert into public.cancellation_fee_config ("freeWindowSeconds", "afterAcceptFee", "afterArrivalFee")
select 60, 200, 500
where not exists (select 1 from public.cancellation_fee_config);
