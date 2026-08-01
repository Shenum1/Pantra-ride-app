-- ============================================================
-- Pantra Ride App — Driver Rating Default Fix (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql and
-- supabase-schema-ratings.sql (does not touch existing policies).
--
-- public.drivers.rating still had "numeric default 5.0" — every real
-- driver signup (via DriverAuthService.signUpWithEmail, which never
-- set rating explicitly) silently inherited that fake 5.0 into real
-- data, even after the app code stopped fabricating a default rating.
-- ============================================================

alter table public.drivers alter column "rating" drop default;
alter table public.drivers alter column "rating" set default null;

-- Only clear rows that never actually received a real rating — a driver
-- who has genuine ratings (totalRatings > 0) keeps their real average.
update public.drivers
set "rating" = null
where coalesce("totalRatings", 0) = 0;
