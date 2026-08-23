-- ============================================================
-- Pantra Ride App — Tunable Pricing Config (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql / supabase-schema-surge-config.sql
-- (does not touch existing tables/policies beyond additive alters).
--
-- Moves fare rates, traffic/event multiplier rules, and the priority-fee
-- amount out of hardcoded TypeScript constants (lib/pricing-config.ts) into
-- Supabase, so an admin can retune pricing from the Supabase dashboard
-- without an app release — same pattern already used for surge_config.
-- There is deliberately no dedicated admin-app UI for these tables yet
-- (surge_config has none either); edit rows directly via the dashboard/SQL.
-- ============================================================

-- One row per ride tier. Client (useRideStore) fetches this and merges it
-- over the TIER_RATES fallback in lib/pricing-config.ts, so a row missing or
-- the whole table being empty/unreachable still works client-side.
create table if not exists public.pricing_tier_config (
  "id"          text primary key,           -- 'standard' | 'comfort' | 'xl'
  "name"        text not null,
  "base"        numeric not null,
  "perKm"       numeric not null,
  "perMin"      numeric not null,
  "minFare"     numeric not null,
  "bookingFee"  numeric not null default 100,
  "serviceFee"  numeric not null default 0,
  "updatedAt"   timestamptz default now()
);

alter table public.pricing_tier_config enable row level security;

drop policy if exists "Anyone can read pricing tier config" on public.pricing_tier_config;
create policy "Anyone can read pricing tier config"
  on public.pricing_tier_config for select using (true);

-- Seeded with the current TIER_RATES defaults (3x the previous rates —
-- those consistently underpriced trips vs. what drivers would accept).
insert into public.pricing_tier_config ("id", "name", "base", "perKm", "perMin", "minFare", "bookingFee", "serviceFee")
values
  ('standard', 'Standard', 999,  270, 24, 1995, 100, 0),
  ('comfort',  'Comfort',  1425, 372, 30, 2565, 100, 0),
  ('xl',       'XL',       1710, 429, 33, 2850, 100, 0)
on conflict ("id") do nothing;

-- Time-of-day / event pricing rules (lib/traffic-multiplier.ts). Distinct
-- signal from surge_config: surge reacts to the live online-driver/pending-
-- ride ratio, this reacts to a scheduled or date-bound window. Multiple
-- active rules take the MAX multiplier, not a stacked product.
create table if not exists public.traffic_multiplier_rules (
  "id"          uuid primary key default gen_random_uuid(),
  "label"       text not null,
  "daysOfWeek"  int[],              -- 0=Sun..6=Sat; null/empty = every day
  "startMinute" int,                -- minutes since local midnight; null+null = all day
  "endMinute"   int,
  "startDate"   timestamptz,        -- absolute range override for one-off events
  "endDate"     timestamptz,
  "multiplier"  numeric not null default 1.0,
  "isEnabled"   boolean not null default true,
  "updatedAt"   timestamptz default now()
);

alter table public.traffic_multiplier_rules enable row level security;

drop policy if exists "Anyone can read traffic multiplier rules" on public.traffic_multiplier_rules;
create policy "Anyone can read traffic multiplier rules"
  on public.traffic_multiplier_rules for select using (true);

-- Weekday rush-hour rules enabled by default. One-off event rules (rain,
-- airport surge, holidays, concerts) aren't seeded — add them via the
-- dashboard with startDate/endDate when the event is known.
insert into public.traffic_multiplier_rules ("label", "daysOfWeek", "startMinute", "endMinute", "multiplier", "isEnabled")
select 'Morning rush', array[1,2,3,4,5], 420, 570, 1.20, true   -- Mon-Fri 07:00-09:30, +20%
where not exists (select 1 from public.traffic_multiplier_rules where "label" = 'Morning rush');

insert into public.traffic_multiplier_rules ("label", "daysOfWeek", "startMinute", "endMinute", "multiplier", "isEnabled")
select 'Evening rush', array[1,2,3,4,5], 990, 1170, 1.35, true  -- Mon-Fri 16:30-19:30, +35%
where not exists (select 1 from public.traffic_multiplier_rules where "label" = 'Evening rush');

-- Single-row config for the "Priority" ride add-on (surfaces the ride first
-- in every online driver's request list — see mapRidesToRequests in
-- lib/firebase-driver-service.ts).
create table if not exists public.pricing_priority_config (
  "id"        uuid primary key default gen_random_uuid(),
  "fee"       numeric not null default 500,
  "isEnabled" boolean not null default true,
  "updatedAt" timestamptz default now()
);

alter table public.pricing_priority_config enable row level security;

drop policy if exists "Anyone can read priority config" on public.pricing_priority_config;
create policy "Anyone can read priority config"
  on public.pricing_priority_config for select using (true);

insert into public.pricing_priority_config ("fee", "isEnabled")
select 500, true
where not exists (select 1 from public.pricing_priority_config);

-- Acceptance-rate feedback into surge (lib/surge-calculator.ts): when the
-- platform-wide accept/decline ratio over the last `acceptanceLookbackMinutes`
-- drops below `lowAcceptanceThreshold`, `lowAcceptanceBonus` is added on top
-- of the ratio-based surge multiplier (still capped at maxMultiplier). This
-- is a demand signal the online-driver/pending-ride ratio alone can't see —
-- drivers actively rejecting requests because the price is too low.
alter table public.surge_config add column if not exists "lowAcceptanceThreshold" numeric default 0.5;
alter table public.surge_config add column if not exists "lowAcceptanceBonus" numeric default 0.3;
alter table public.surge_config add column if not exists "acceptanceLookbackMinutes" int default 60;

-- Rides table columns for the priority add-on.
alter table public.rides add column if not exists "isPriority" boolean default false;
alter table public.rides add column if not exists "priorityFee" numeric default 0;
