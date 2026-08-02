-- ============================================================
-- Pantra Ride App — Cancellation Fee Column (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql (does not touch
-- existing tables/policies, only adds a column to public.rides).
-- ============================================================

-- Rider-initiated cancellation fee, computed at cancel time from
-- "acceptedAt"/"arrivedAt" (see lib/cancellation-calculator.ts). Unlike
-- bookingFee/serviceFee/zoneFee/waitingCharge, this goes through the normal
-- 80/20 commission split — it's treated like a regular fare, not a
-- platform-owned or driver-only charge.
alter table public.rides add column if not exists "cancellationFee" numeric default 0;
