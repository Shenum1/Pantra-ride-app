-- ============================================================
-- Pantra Ride App — Ride Payment Status + Settlement Guard (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql / supabase-schema-ride-commission-snapshot.sql
-- (does not touch existing tables/policies beyond additive alters and one
-- new BEFORE UPDATE trigger on public.rides).
-- ============================================================

-- Whether the rider has actually paid for this ride. Previously there was no
-- such column at all — a ride could be marked 'completed' (crediting driver
-- earnings) regardless of whether payment succeeded, because nothing
-- checked. 'unpaid' is the default so every existing/new row starts
-- unsettled until something explicitly confirms payment.
alter table public.rides add column if not exists "paymentStatus" text
  check ("paymentStatus" in ('unpaid', 'pending', 'paid', 'failed'))
  default 'unpaid';

-- Settlement guard: enforces the payment gate, computes commission
-- server-side, and makes a ride's settlement fields immutable once set.
--
-- Rationale for each piece:
--  1. A ride cannot transition to 'completed' unless paymentStatus is
--     already 'paid' in the SAME update statement — the caller (rider or
--     driver client) must confirm payment succeeded (cash confirmed, wallet
--     debited, or an online payment verified) before completion, not after.
--  2. platformCommissionRate/platformCommissionAmount/driverEarningsAmount
--     are computed here from fare/fee columns, overriding whatever the
--     client sent for those three columns — a client can propose a
--     "completed" transition, but never dictate its own earnings. The
--     formula mirrors calculateDriverPayout() in lib/fare-calculator.ts
--     exactly (metered fare = fare minus the flat, non-commissionable fees;
--     commission = metered fare * rate; driver earnings = fare - commission)
--     — keep the two in sync if that function ever changes.
--  3. Once a ride is 'completed' or 'cancelled', its settlement fields are
--     locked: a second attempt to settle it again (status re-set to a
--     terminal value, or any of the financial columns changed directly) is
--     rejected outright. This is what actually prevents double-crediting a
--     driver for one ride, independent of whichever client (rider app or
--     driver app — both can call this) got there first.
create or replace function public.rides_settle_trigger()
returns trigger
language plpgsql as $$
declare
  v_rate constant numeric := 0.1; -- keep in sync with PLATFORM_COMMISSION_RATE, lib/pricing-config.ts
  v_metered_fare numeric;
  v_commission numeric;
begin
  -- Ride already settled: reject any further attempt to settle it again, and
  -- reject any direct tampering with the settlement fields, but allow
  -- unrelated columns (driverRating, etc.) to keep updating normally.
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

  -- Fresh transition into 'completed': payment must already be confirmed.
  if NEW."status" = 'completed' then
    if NEW."paymentStatus" is distinct from 'paid' then
      raise exception 'ride % cannot be completed before payment is confirmed (paymentStatus=%)', NEW."id", NEW."paymentStatus";
    end if;

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

    NEW."platformCommissionRate" := v_rate;
    NEW."platformCommissionAmount" := v_commission;
    NEW."driverEarningsAmount" := coalesce(NEW."fare", 0) - v_commission;
  end if;

  -- Fresh transition into 'cancelled' with a chargeable cancellation fee
  -- settles the same way (see cancellationFee's doc comment) — not gated on
  -- paymentStatus, since cancellation fees aren't collected through the
  -- online-payment/wallet flow.
  if NEW."status" = 'cancelled' and coalesce(NEW."cancellationFee", 0) > 0 then
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
