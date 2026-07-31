-- ============================================================
-- Pantra Ride App — Rider Ratings Schema (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql (does not touch
-- existing tables/policies, only public.users).
-- ============================================================

-- 1. Riders had no real rating source (no driver-rates-rider flow existed),
--    so the "rating" column always held the fake 5.0 default. Drop that
--    default going forward and null out existing rows — they were never
--    backed by a real rating.
alter table public.users alter column "rating" drop default;
alter table public.users alter column "rating" set default null;
update public.users set "rating" = null;

-- 2. Track how many ratings a rider has actually received, same pattern
--    as drivers."totalRatings" in supabase-schema-ratings.sql.
alter table public.users add column if not exists "totalRatings" integer default 0;
