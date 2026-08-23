-- ============================================================
-- Pantra Ride App — Ride Commission Snapshot (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql (does not touch
-- existing tables/policies, only adds columns to public.rides).
-- ============================================================

-- Commission is computed once, by calculateDriverPayout() in
-- lib/fare-calculator.ts, and snapshotted here the moment a ride settles
-- (completed, or cancelled with a chargeable cancellation fee) — see
-- FirebaseDriverService.updateRideStatus and useRideStore's savePastRide.
-- This makes commission auditable and rate changes non-retroactive: bumping
-- PLATFORM_COMMISSION_RATE (lib/pricing-config.ts) only affects rides
-- settled AFTER the change. Readers (getDriverEarnings/getDriverStats, the
-- admin overview) prefer these columns and fall back to a live
-- recalculation at the CURRENT rate only for legacy rows predating this
-- migration.
alter table public.rides add column if not exists "platformCommissionRate" numeric;
alter table public.rides add column if not exists "platformCommissionAmount" numeric;
alter table public.rides add column if not exists "driverEarningsAmount" numeric;
