-- ============================================================
-- Pantra Ride App — Lock Ride Status Once Terminal (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema-money-precision.sql (the most recent prior
-- redefinition of rides_settle_trigger()).
--
-- Pre-Phase-1.1 verification finding: rides_settle_trigger()'s terminal-state
-- guard only raised an exception when NEW."status" was ALSO 'completed' or
-- 'cancelled' (i.e. it only blocked re-settling to another terminal state).
-- It never blocked reverting a terminal ride's status back to a NON-terminal
-- one (e.g. 'completed' -> 'pending' or 'completed' -> 'accepted'), as long
-- as the financial columns themselves weren't touched in the same statement.
--
-- This is exploitable for a real double-payout: revert a completed ride to
-- 'pending' (fare/commission/driverEarningsAmount stay locked, so this alone
-- raises no exception), have a DIFFERENT driver accept it via the existing
-- "Drivers can accept pending rides" policy (which only constrains driverId,
-- nothing else), then complete it again. rides_settle_trigger recomputes
-- driverEarningsAmount identically (fare is unchanged) but now attributes it
-- to the new driverId — so get_driver_available_balance() would let a SECOND
-- driver also claim the same ride's earnings, even if the first driver had
-- already been paid out against it.
--
-- Fix: once a ride is terminal, its status becomes fully immutable to a
-- non-service-role caller — not just the specific financial columns. This
-- is a strict superset of (and replaces) the old "NEW.status also terminal"
-- check: `NEW."status" is distinct from OLD."status"` blocks re-settling to
-- another terminal state AND reverting to a non-terminal one, in one
-- condition. Applies regardless of caller role, same as every other clause
-- in this function (rides_settle_trigger has never had a service_role
-- exemption — no legitimate code path anywhere reverts a terminal ride's
-- status, admin tooling included).
-- ============================================================

create or replace function public.rides_settle_trigger()
returns trigger
language plpgsql as $$
declare
  v_rate numeric;
  v_metered_fare numeric;
  v_commission numeric;
begin
  if OLD."status" in ('completed', 'cancelled') then
    if NEW."status" is distinct from OLD."status" then
      raise exception 'ride % is already settled (status=%); its status cannot change', OLD."id", OLD."status";
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
    v_commission := round(v_metered_fare * v_rate, 2);

    NEW."platformCommissionRate" := v_rate;
    NEW."platformCommissionAmount" := v_commission;
    NEW."driverEarningsAmount" := coalesce(NEW."fare", 0) - v_commission;
  end if;

  if NEW."status" = 'cancelled' and coalesce(NEW."cancellationFee", 0) > 0 then
    select "rate" into v_rate from public.platform_commission_config limit 1;
    v_rate := coalesce(v_rate, 0.1);
    v_commission := round(coalesce(NEW."cancellationFee", 0) * v_rate, 2);
    NEW."platformCommissionRate" := v_rate;
    NEW."platformCommissionAmount" := v_commission;
    NEW."driverEarningsAmount" := coalesce(NEW."cancellationFee", 0) - v_commission;
  end if;

  return NEW;
end;
$$;
