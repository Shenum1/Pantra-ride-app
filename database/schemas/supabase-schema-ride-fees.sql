-- ============================================================
-- Pantra Ride App — Ride Fee Breakdown Columns (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql (does not touch
-- existing tables/policies, only adds columns to public.rides).
-- ============================================================

-- Flat fees applied after surge/minimum-fare, per the pricing pipeline in
-- lib/fare-calculator.ts. Both default to 0 so existing rows and the
-- current fare total are unaffected until fees are actually turned on.
alter table public.rides add column if not exists "bookingFee" numeric default 0;
alter table public.rides add column if not exists "serviceFee" numeric default 0;
