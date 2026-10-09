-- ============================================================
-- Pay up to half of a ride with reward points
-- ============================================================
-- Rules (agreed with the owner 2026-10-08):
--   * 1 point = ₦16; points may cover at most 50% of a fare, in whole points.
--   * The server (rides.create) decides the amount; the app only asks to use
--     points. See lib/points-config.ts.
--   * Pantra funds the points part. The driver is paid exactly as before:
--       wallet ride: the rider's wallet is debited fare - points value; the
--                    driver's earnings are unchanged (paid out by Pantra).
--       cash ride:   the driver collects fare - points value in cash, and
--                    Pantra credits the driver the points value in
--                    driver_commission_ledger ('points_credit'), so their net
--                    is the same as if the rider had paid the full fare in cash.
--   * Points are reserved when the ride is booked and returned in full if the
--     ride is cancelled.
-- Re-runnable.
-- ============================================================

-- 1. What each ride used --------------------------------------------------------
alter table public.rides
  add column if not exists "pointsUsed" integer not null default 0 check ("pointsUsed" >= 0),
  add column if not exists "pointsValueNGN" numeric(12,2) not null default 0 check ("pointsValueNGN" >= 0);

-- Only the server sets these (rides.create, service role). A ride's rider or
-- driver can update their own ride row, so this keeps the points out of reach.
create or replace function public.rides_protect_points_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return NEW;
  end if;

  if NEW."pointsUsed" is distinct from OLD."pointsUsed"
     or NEW."pointsValueNGN" is distinct from OLD."pointsValueNGN"
  then
    raise exception 'rides.%: points fields can only be set by the server', NEW."id";
  end if;

  return NEW;
end;
$$;

drop trigger if exists rides_protect_points_columns on public.rides;
create trigger rides_protect_points_columns
  before update on public.rides
  for each row execute function public.rides_protect_points_columns();

-- 2. Points ledger: a return row type, and one redemption / one return per ride -----
alter table public.points_transactions drop constraint if exists points_transactions_type_check;
alter table public.points_transactions
  add constraint points_transactions_type_check
  check (type in ('task_reward', 'ride_redemption', 'expiry', 'ad_reward', 'ride_refund'));

create unique index if not exists idx_points_one_redemption_per_ride
  on public.points_transactions ("referenceId") where type = 'ride_redemption';
create unique index if not exists idx_points_one_refund_per_ride
  on public.points_transactions ("referenceId") where type = 'ride_refund';

-- 3. Reserve points for a ride -----------------------------------------------------
-- Balance = unexpired rows, never below zero (earned points expire after 90
-- days but spent rows don't, so the raw sum can dip under zero).
create or replace function public.reserve_ride_points(p_user_id text, p_ride_id uuid, p_points integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_points is null or p_points <= 0 then
    return;
  end if;

  -- One rider's reservations run one at a time, so two bookings can't spend the same points.
  perform pg_advisory_xact_lock(hashtext('points:' || p_user_id));

  select greatest(coalesce(sum("amount"), 0), 0)::integer into v_balance
  from public.points_transactions
  where "userId" = p_user_id
    and ("expiresAt" is null or "expiresAt" > now());

  if v_balance < p_points then
    raise exception 'INSUFFICIENT_POINTS';
  end if;

  insert into public.points_transactions ("userId", "amount", "type", "referenceId", "description", "expiresAt")
  values (p_user_id, -p_points, 'ride_redemption', p_ride_id::text,
          'Ride payment — ' || p_points || ' points', null)
  on conflict ("referenceId") where type = 'ride_redemption' do nothing;
end;
$$;

revoke all on function public.reserve_ride_points(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_ride_points(text, uuid, integer) to service_role;

-- 4. Return a ride's points (idempotent) --------------------------------------------
-- Returned points get a fresh 90-day expiry. Returns how many were returned
-- by this call (0 if none were used or they were already returned).
create or replace function public.refund_ride_points(p_ride_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.points_transactions;
  v_inserted integer;
begin
  select * into v_row
  from public.points_transactions
  where "referenceId" = p_ride_id::text and type = 'ride_redemption';

  if not found then
    return 0;
  end if;

  insert into public.points_transactions ("userId", "amount", "type", "referenceId", "description", "expiresAt")
  values (v_row."userId", -v_row."amount", 'ride_refund', p_ride_id::text,
          'Points returned — ride cancelled or refunded', now() + interval '90 days')
  on conflict ("referenceId") where type = 'ride_refund' do nothing;

  get diagnostics v_inserted = row_count;
  return case when v_inserted > 0 then -v_row."amount" else 0 end;
end;
$$;

revoke all on function public.refund_ride_points(uuid) from public, anon, authenticated;
grant execute on function public.refund_ride_points(uuid) to service_role;

-- A cancelled ride gives its points back, whoever cancelled it and however.
create or replace function public.rides_return_points_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW."status" = 'cancelled'
     and OLD."status" is distinct from 'cancelled'
     and coalesce(NEW."pointsUsed", 0) > 0
  then
    perform public.refund_ride_points(NEW."id");
  end if;
  return NEW;
end;
$$;

drop trigger if exists rides_return_points_on_cancel on public.rides;
create trigger rides_return_points_on_cancel
  after update of status on public.rides
  for each row execute function public.rides_return_points_on_cancel();

-- 5. Driver settlement for cash rides paid partly with points ------------------------
alter table public.driver_commission_ledger drop constraint if exists driver_commission_ledger_type_check;
alter table public.driver_commission_ledger
  add constraint driver_commission_ledger_type_check
  check ("type" in ('cash_commission_debit', 'cash_commission_settlement', 'adjustment', 'points_credit'));

alter table public.driver_commission_ledger drop constraint if exists driver_commission_ledger_sign_check;
alter table public.driver_commission_ledger
  add constraint driver_commission_ledger_sign_check
  check (
    ("type" <> 'cash_commission_debit' or "amount" < 0)
    and ("type" <> 'cash_commission_settlement' or ("amount" > 0 and "reference" is not null))
    and ("type" <> 'points_credit' or "amount" > 0)
  );

create unique index if not exists idx_driver_commission_ledger_ride_points_credit
  on public.driver_commission_ledger ("rideId") where "type" = 'points_credit';

-- Same as before (the cash commission debit), plus the points credit.
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
  then
    if coalesce(NEW."platformCommissionAmount", 0) > 0 then
      insert into public.driver_commission_ledger ("driverId", "rideId", "type", "amount", "reason")
      values (
        NEW."driverId",
        NEW."id",
        'cash_commission_debit',
        -NEW."platformCommissionAmount",
        'Commission owed on cash ride ' || NEW."id"
      )
      on conflict ("rideId") where "type" = 'cash_commission_debit' do nothing;
    end if;

    -- The rider paid part of this fare with points, so the driver collected
    -- less cash than the fare. Pantra makes that part up.
    if coalesce(NEW."pointsValueNGN", 0) > 0 then
      insert into public.driver_commission_ledger ("driverId", "rideId", "type", "amount", "reason")
      values (
        NEW."driverId",
        NEW."id",
        'points_credit',
        NEW."pointsValueNGN",
        'Paid by rider points on cash ride ' || NEW."id"
      )
      on conflict ("rideId") where "type" = 'points_credit' do nothing;
    end if;
  end if;

  return NEW;
end;
$$;
