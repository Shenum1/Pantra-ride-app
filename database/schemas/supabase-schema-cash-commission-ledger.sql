-- ============================================================
-- Pantra Ride App — Cash Ride Commission Debt Ledger (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema-platform-commission-config.sql,
--            supabase-schema-driver-payouts-automation.sql,
--            supabase-schema-tips.sql.
--
-- Problem this fixes: for a CASH ride the rider pays the driver the full
-- fare directly, outside Pantra. Pantra never holds that money. Before this
-- migration, rides_settle_trigger() computed driverEarningsAmount the SAME
-- way for cash and wallet rides (fare - commission) and
-- get_driver_available_balance() summed it unconditionally — so a cash ride
-- silently made the driver eligible for an ADDITIONAL automated payout on
-- top of the cash they already pocketed, while Pantra collected zero
-- commission on that ride. Confirmed by direct code audit: no debit, no
-- ledger, no reconciliation of any kind existed for cash commission.
--
-- Fix: for a cash ride, Pantra owes the driver nothing through the payout
-- system (driverEarningsAmount := 0 — they already hold the full fare in
-- person); the commission they owe Pantra is recorded as a debt in
-- driver_commission_ledger and subtracted from their payout-eligible
-- balance until offset by a settlement entry. platformCommissionAmount is
-- left computed the same way as before for ALL rides (needed for admin
-- revenue reporting regardless of how the ride was paid for).
-- ============================================================

-- ----------------------------------------------------------------
-- 1. driver_commission_ledger
-- ----------------------------------------------------------------
-- One row per debt/settlement event against a driver's payout eligibility.
-- Negative amount = debt (reduces payout-eligible balance), positive =
-- settlement/credit (e.g. an admin recording that a driver paid their cash
-- commission debt back in, out of band). Scoped to a single ride for the
-- 'cash_commission_debit' type so it can be tied back to the ride that
-- generated it; nullable for 'adjustment'/'settlement' rows an admin creates
-- manually.
create table if not exists public.driver_commission_ledger (
  "id"        uuid primary key default gen_random_uuid(),
  "driverId"  uuid not null references public.drivers("id") on delete restrict,
  "rideId"    uuid references public.rides("id") on delete restrict,
  "type"      text not null check ("type" in (
                'cash_commission_debit', 'cash_commission_settlement', 'adjustment'
              )),
  "amount"    numeric(12,2) not null,
  "reason"    text,
  "createdBy" uuid references public.users("uid") on delete restrict,
  "createdAt" timestamptz not null default now()
);

create index if not exists idx_driver_commission_ledger_driver on public.driver_commission_ledger("driverId");
create index if not exists idx_driver_commission_ledger_ride on public.driver_commission_ledger("rideId");

-- Idempotency: at most one 'cash_commission_debit' row per ride. This is
-- defense-in-depth — rides_settle_trigger() below only ever fires this
-- INSERT on the single fresh transition into 'completed' (the existing
-- immutability guard at the top of the function already prevents the
-- trigger from running a second time for the same ride), but a partial
-- unique index makes a double-debit structurally impossible even if that
-- guard is ever weakened later.
create unique index if not exists idx_driver_commission_ledger_ride_debit
  on public.driver_commission_ledger("rideId") where "type" = 'cash_commission_debit';

alter table public.driver_commission_ledger enable row level security;

drop policy if exists "Drivers can read own commission ledger" on public.driver_commission_ledger;
create policy "Drivers can read own commission ledger"
  on public.driver_commission_ledger for select
  using (auth.uid() in (select "userId" from public.drivers where "id" = "driverId"));
-- No insert/update/delete policy for anyone — only the debit trigger below
-- (SECURITY DEFINER, since it fires inside the DRIVER's own update when
-- their app completes a ride) and admin routes (service-role) ever write here.

-- ----------------------------------------------------------------
-- 1b. ride_payment_is_cash(): one definition of "this ride was paid in cash"
-- ----------------------------------------------------------------
-- rides.create now always stores the plain method ('cash' / 'wallet'), but
-- rides booked before that change stored the id of the rider's saved
-- payment_methods row instead — so a saved row is resolved too. A legacy
-- 'card' row counts as cash: card charging was never built, so the driver
-- was paid in person exactly like a cash ride.
--
-- SECURITY DEFINER because it's called from triggers that run as the DRIVER
-- (their app completes the ride), and RLS only lets a rider read their own
-- payment_methods rows. It returns a boolean and nothing else.
create or replace function public.ride_payment_is_cash(p_payment_method text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(p_payment_method, '')) = 'cash'
    or exists (
      select 1 from public.payment_methods pm
      where pm."id"::text = p_payment_method
        and pm."type" in ('cash', 'card')
    );
$$;

-- ----------------------------------------------------------------
-- 2. rides_settle_trigger(): cash rides accrue a commission debt instead of
--    double-counting driverEarningsAmount
-- ----------------------------------------------------------------
create or replace function public.rides_settle_trigger()
returns trigger
language plpgsql as $$
declare
  v_rate numeric;
  v_metered_fare numeric;
  v_commission numeric;
  v_is_cash boolean;
begin
  if OLD."status" in ('completed', 'cancelled') then
    if NEW."status" in ('completed', 'cancelled') then
      raise exception 'ride % is already settled (status=%); it cannot be settled again', OLD."id", OLD."status";
    end if;

    if NEW."fare" is distinct from OLD."fare"
       or NEW."platformCommissionRate" is distinct from OLD."platformCommissionRate"
       or NEW."platformCommissionAmount" is distinct from OLD."platformCommissionAmount"
       or NEW."driverEarningsAmount" is distinct from OLD."driverEarningsAmount"
       or NEW."paymentStatus" is distinct from OLD."paymentStatus"
    then
      raise exception 'ride % is already settled; its settlement fields are immutable', OLD."id";
    end if;

    return NEW;
  end if;

  if NEW."status" = 'completed' then
    if NEW."paymentStatus" is distinct from 'paid' then
      raise exception 'ride % cannot be completed before payment is confirmed (paymentStatus=%)', NEW."id", NEW."paymentStatus";
    end if;

    select "rate" into v_rate from public.platform_commission_config limit 1;
    v_rate := coalesce(v_rate, 0.1);

    v_metered_fare := greatest(
      coalesce(NEW."fare", 0)
        - coalesce(NEW."bookingFee", 0)
        - coalesce(NEW."serviceFee", 0)
        - coalesce(NEW."zoneFee", 0)
        - coalesce(NEW."waitingCharge", 0)
        - coalesce(NEW."priorityFee", 0),
      0
    );
    v_commission := v_metered_fare * v_rate;
    v_is_cash := public.ride_payment_is_cash(NEW."paymentMethod");

    NEW."platformCommissionRate" := v_rate;
    NEW."platformCommissionAmount" := v_commission;

    if v_is_cash then
      -- The driver already collected 100% of the fare in person — Pantra
      -- owes nothing through the payout system for this ride.
      NEW."driverEarningsAmount" := 0;
    else
      NEW."driverEarningsAmount" := coalesce(NEW."fare", 0) - v_commission;
    end if;
  end if;

  if NEW."status" = 'cancelled' and coalesce(NEW."cancellationFee", 0) > 0 then
    select "rate" into v_rate from public.platform_commission_config limit 1;
    v_rate := coalesce(v_rate, 0.1);

    v_commission := coalesce(NEW."cancellationFee", 0) * v_rate;

    NEW."platformCommissionRate" := v_rate;
    NEW."platformCommissionAmount" := v_commission;
    NEW."driverEarningsAmount" := coalesce(NEW."cancellationFee", 0) - v_commission;
  end if;

  return NEW;
end;
$$;

drop trigger if exists rides_settle_guard on public.rides;
create trigger rides_settle_guard
  before update on public.rides
  for each row execute function public.rides_settle_trigger();

-- The ledger debit itself is written by a SEPARATE AFTER trigger (not inside
-- rides_settle_trigger(), which is BEFORE UPDATE and mutates NEW — a BEFORE
-- trigger can't safely INSERT into another table keyed off a NEW.id that
-- isn't committed yet in all edge cases, and keeping "compute settlement
-- fields" and "write the debt ledger row" as two separate single-purpose
-- triggers keeps each one easy to reason about independently).
--
-- SECURITY DEFINER is required, not optional: drivers complete rides from
-- their own app session (lib/firebase-driver-service.ts updateRideStatus),
-- so this trigger runs as the driver — and driver_commission_ledger has no
-- insert policy. Without it, the insert is rejected and the driver's whole
-- "complete ride" update rolls back. The driver controls nothing written
-- here: the amount is the commission rides_settle_trigger() just computed
-- (overriding anything the client sent), recorded against that driver.
create or replace function public.rides_cash_commission_debit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW."status" = 'completed'
     and OLD."status" is distinct from 'completed'
     and public.ride_payment_is_cash(NEW."paymentMethod")
     and NEW."driverId" is not null
     and coalesce(NEW."platformCommissionAmount", 0) > 0
  then
    insert into public.driver_commission_ledger ("driverId", "rideId", "type", "amount", "reason")
    values (
      NEW."driverId",
      NEW."id",
      'cash_commission_debit',
      -NEW."platformCommissionAmount",
      'Commission owed on cash ride ' || NEW."id"
    )
    -- Idempotent no-op on a retried/duplicate trigger invocation for the
    -- same ride (idx_driver_commission_ledger_ride_debit above).
    on conflict ("rideId") where "type" = 'cash_commission_debit' do nothing;
  end if;

  return NEW;
end;
$$;

drop trigger if exists rides_cash_commission_debit_guard on public.rides;
create trigger rides_cash_commission_debit_guard
  after update on public.rides
  for each row execute function public.rides_cash_commission_debit_trigger();

-- ----------------------------------------------------------------
-- 3. get_driver_available_balance(): subtract outstanding cash-commission
--    debt from the payout-eligible balance
-- ----------------------------------------------------------------
-- This is now the ONE complete definition. Three earlier migrations each
-- redefined this function with a different subset, so whichever ran last
-- won: supabase-schema-tips.sql (earnings + tips, but forgot to reserve
-- manual_review payouts) and supabase-schema-driver-payouts-automation.sql
-- (reserves manual_review, but dropped tips). Run this migration AFTER both
-- of those. Formula: completed+paid ride earnings + successful tips +
-- cash-commission ledger - every payout still reserving money.
CREATE OR REPLACE FUNCTION public.get_driver_available_balance(driver_id text)
RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT GREATEST(
    COALESCE((
      SELECT SUM(r."driverEarningsAmount")
      FROM public.rides r
      WHERE r."driverId"::text = driver_id
        AND r."status" = 'completed'
        AND r."paymentStatus" = 'paid'
    ), 0)
    + COALESCE((
      SELECT SUM(t."amount")
      FROM public.tips t
      WHERE t."driverId"::text = driver_id
        AND t."status" = 'successful'
    ), 0)
    + COALESCE((
      SELECT SUM(l."amount")
      FROM public.driver_commission_ledger l
      WHERE l."driverId"::text = driver_id
    ), 0)
    - COALESCE((
      SELECT SUM(p."amount")
      FROM public.driver_payouts p
      WHERE p."driverId" = driver_id
        AND p."status" IN ('pending', 'processing', 'manual_review', 'completed')
    ), 0),
    0
  );
$$;

-- Raw (non-floored-at-zero) variant — needed by the cash-dispatch-risk check
-- below, which must be able to see a driver's balance go negative (that's
-- the whole signal it's checking for). get_driver_available_balance() above
-- stays GREATEST(...,0) unchanged for payout-request validation, where a
-- negative "available to withdraw" has never been a meaningful concept.
CREATE OR REPLACE FUNCTION public.get_driver_net_balance(driver_id text)
RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE((
      SELECT SUM(r."driverEarningsAmount")
      FROM public.rides r
      WHERE r."driverId"::text = driver_id
        AND r."status" = 'completed'
        AND r."paymentStatus" = 'paid'
    ), 0)
    + COALESCE((
      SELECT SUM(t."amount")
      FROM public.tips t
      WHERE t."driverId"::text = driver_id
        AND t."status" = 'successful'
    ), 0)
    + COALESCE((
      SELECT SUM(l."amount")
      FROM public.driver_commission_ledger l
      WHERE l."driverId"::text = driver_id
    ), 0)
    - COALESCE((
      SELECT SUM(p."amount")
      FROM public.driver_payouts p
      WHERE p."driverId" = driver_id
        AND p."status" IN ('pending', 'processing', 'manual_review', 'completed')
    ), 0);
$$;

-- ----------------------------------------------------------------
-- Known, disclosed side effect on admin reporting
-- ----------------------------------------------------------------
-- admin.overview sums rides.driverEarningsAmount across ALL rides regardless
-- of payment method as its "driver earnings" KPI. Because driverEarningsAmount
-- is now 0 for cash rides (by design — see header), that KPI will undercount
-- what drivers actually took home in cash. This is a deliberate trade-off:
-- driverEarningsAmount now means "amount payable to the driver via Pantra's
-- payout system", which is what get_driver_available_balance() needs to be
-- correct. Restoring a complete "total driver take-home including cash"
-- figure for the admin dashboard is a separate, additive reporting change
-- (e.g. summing driverEarningsAmount + ABS(cash_commission_debit amounts) +
-- (cash ride fares - their commission)) and was not implemented here since
-- it wasn't part of what was asked — flagging it rather than silently
-- leaving the dashboard number wrong without explanation.
