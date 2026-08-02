-- ============================================================
-- Pantra Ride App — Ride Zone Fee Column (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql (does not touch
-- existing tables/policies, only adds a column to public.rides).
-- ============================================================

-- Flat, platform-owned zone surcharge (e.g. airport pickup/dropoff), same
-- treatment as bookingFee/serviceFee: never surged, discounted, or
-- negotiated, and excluded from driver commission. Defaults to 0 so
-- existing rows and the current fare total are unaffected.
alter table public.rides add column if not exists "zoneFee" numeric default 0;
