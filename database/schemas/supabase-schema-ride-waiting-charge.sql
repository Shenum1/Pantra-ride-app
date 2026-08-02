-- ============================================================
-- Pantra Ride App — Waiting Charge Columns (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql (does not touch
-- existing tables/policies, only adds columns to public.rides).
-- ============================================================

-- "arrivedAt" is set once, the moment the driver reaches pickup (see
-- hooks/useRideStore.ts's updateRideSession). "startedAt" already exists.
-- "waitingCharge" is computed from the two once the trip starts and added to
-- the ride's fare — unlike bookingFee/serviceFee/zoneFee, it is 100% driver
-- compensation, excluded from commission for the opposite reason (see
-- lib/fare-calculator.ts's calculateDriverPayout).
alter table public.rides add column if not exists "arrivedAt" timestamptz;
alter table public.rides add column if not exists "waitingCharge" numeric default 0;
