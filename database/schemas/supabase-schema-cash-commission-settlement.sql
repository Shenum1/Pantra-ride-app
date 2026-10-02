-- ============================================================
-- Pantra Ride App — Cash commission: dispatch limit + settlement (additive)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema-cash-commission-ledger.sql (uses its
--            ride_payment_is_cash() and get_driver_net_balance()).
--
-- A driver who owes Pantra more than the cash-debt limit in commission from
-- cash rides can no longer accept cash rides until they pay it down. They
-- pay either in the app (Flutterwave checkout — recorded automatically when
-- Flutterwave confirms) or by bank transfer/in person, recorded by an admin.
-- Both kinds of payment are 'cash_commission_settlement' rows in
-- driver_commission_ledger, so they flow straight into the same net
-- balance that decides whether the driver is blocked.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. The limit — one adjustable value, read by the database check below and
--    by the app (driver.cashEligibility), so the two can't disagree.
-- ----------------------------------------------------------------
-- A driver is blocked once they owe MORE than this (their net balance —
-- earnings + tips + commission ledger − payouts — is below −cashDebtLimit).
alter table public.platform_commission_config
  add column if not exists "cashDebtLimit" numeric(12,2) not null default 5000;

create or replace function public.get_driver_cash_debt_limit()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select "cashDebtLimit" from public.platform_commission_config limit 1), 5000);
$$;

-- ----------------------------------------------------------------
-- 2. Settlements: reference + integrity rules
-- ----------------------------------------------------------------
-- reference: the Flutterwave payment reference (in-app payments) or the
-- bank transfer/receipt reference an admin typed in. Unique per settlement,
-- which is what makes recording one idempotent — a Flutterwave webhook and
-- the app's own confirmation racing for the same payment, or an admin
-- double-clicking, can only ever produce one settlement row.
alter table public.driver_commission_ledger add column if not exists "reference" text;

create unique index if not exists idx_driver_commission_ledger_settlement_reference
  on public.driver_commission_ledger ("reference")
  where "type" = 'cash_commission_settlement';

alter table public.driver_commission_ledger drop constraint if exists driver_commission_ledger_sign_check;
alter table public.driver_commission_ledger
  add constraint driver_commission_ledger_sign_check
  check (
    ("type" <> 'cash_commission_debit' or "amount" < 0)
    and ("type" <> 'cash_commission_settlement' or ("amount" > 0 and "reference" is not null))
  );

-- ----------------------------------------------------------------
-- 3. The block itself — enforced where a ride is actually accepted
-- ----------------------------------------------------------------
-- Drivers accept rides by writing to the rides row directly from their app
-- (lib/firebase-driver-service.ts acceptRide, allowed by the "Drivers can
-- accept pending rides" RLS policy). Checking here, rather than only hiding
-- cash rides in the app, means no client — modified or out of date — can
-- get around it.
--
-- SECURITY DEFINER: it runs as the accepting driver, and computing their
-- balance reads tables RLS wouldn't fully show them.
create or replace function public.rides_cash_dispatch_guard_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW."status" = 'accepted'
     and OLD."status" is distinct from 'accepted'
     and NEW."driverId" is not null
     and public.ride_payment_is_cash(NEW."paymentMethod")
     and public.get_driver_net_balance(NEW."driverId"::text) < -public.get_driver_cash_debt_limit()
  then
    -- The app matches on this CASH_RIDES_PAUSED prefix to show the driver a
    -- readable message instead of a raw database error.
    raise exception 'CASH_RIDES_PAUSED: this driver owes more than the cash commission limit and must settle it before accepting cash rides';
  end if;
  return NEW;
end;
$$;

drop trigger if exists rides_cash_dispatch_guard on public.rides;
create trigger rides_cash_dispatch_guard
  before update on public.rides
  for each row execute function public.rides_cash_dispatch_guard_trigger();

-- ----------------------------------------------------------------
-- 4. Admin summary — every driver with commission activity
-- ----------------------------------------------------------------
-- Service-role only (the admin routes): it exposes every driver's balance.
create or replace function public.get_drivers_commission_summary()
returns table (
  "driverId" uuid,
  "netBalance" numeric,
  "totalCommission" numeric,
  "totalSettled" numeric,
  "lastSettlementAt" timestamptz
)
language sql
stable
as $$
  select
    l."driverId",
    public.get_driver_net_balance(l."driverId"::text),
    coalesce(-sum(l."amount") filter (where l."type" = 'cash_commission_debit'), 0),
    coalesce(sum(l."amount") filter (where l."type" = 'cash_commission_settlement'), 0),
    max(l."createdAt") filter (where l."type" = 'cash_commission_settlement')
  from public.driver_commission_ledger l
  group by l."driverId";
$$;

revoke all on function public.get_drivers_commission_summary() from public, anon, authenticated;
grant execute on function public.get_drivers_commission_summary() to service_role;
