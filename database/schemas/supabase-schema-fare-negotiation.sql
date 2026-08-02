-- ============================================================
-- Pantra Ride App — Fare Negotiation Columns (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql (does not touch
-- existing tables/policies, only adds columns to public.rides).
-- ============================================================

-- Single active offer per ride (this pull-model marketplace has no
-- per-driver targeting or counter-offer history — a negotiated ride is just
-- a normal pending ride with a rider-proposed price attached, visible to
-- any online driver same as a regular ride request).
alter table public.rides add column if not exists "offeredFare" numeric;
alter table public.rides add column if not exists "negotiationStatus" text
  check ("negotiationStatus" in ('pending', 'accepted', 'rejected', 'expired'));
alter table public.rides add column if not exists "offerExpiresAt" timestamptz;
