-- ============================================================
-- Pantra Ride App — Book For Someone Else (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql (does not touch
-- existing tables/policies, only adds columns to public.rides).
-- ============================================================

-- When set, this ride was booked by the account holder (rides.userId) on
-- behalf of a different physical passenger who has no app account. The
-- booker remains the ride's owner for billing/history/messaging; these
-- columns only override the display name/phone shown to the driver.
alter table public.rides add column if not exists "passengerName" text;
alter table public.rides add column if not exists "passengerPhone" text;
