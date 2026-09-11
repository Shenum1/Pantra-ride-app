-- ============================================================
-- Pantra Ride App — Lock Down Ride Financial Columns (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema.sql, supabase-schema-ride-payment-status.sql,
-- supabase-schema-platform-commission-config.sql, supabase-schema-fee-config.sql,
-- supabase-schema-rides-server-authoritative-fare.sql.
--
-- Closes the core P0 finding: the "Rider or driver can update ride" RLS
-- policy (supabase-schema.sql) has no WITH CHECK clause, so any rider/driver
-- party to a ride can update ANY column — including fare, fees, distance,
-- duration, and even the settlement snapshot columns — to any value via a
-- direct client update. rides_settle_trigger() only locks commission/earnings
-- down once a ride is terminal; it never validates fare itself and does
-- nothing to protect a ride that never reaches settlement.
--
-- This trigger is named to sort alphabetically BEFORE rides_settle_guard
-- ("rides_protect_financial_columns_guard" < "rides_settle_guard"), so
-- Postgres fires it first on every UPDATE — financial columns are locked
-- down/corrected before rides_settle_trigger() computes commission off of
-- whatever fare value survives this trigger.
--
-- Two legitimate client-triggered financial transitions exist in the current
-- app and are preserved here, but RECOMPUTED server-side from trusted
-- config/timestamps rather than trusted from the client's own number:
--   - accepted -> in-progress: driver-side trip start bumps `waitingCharge`
--     (lib/firebase-driver-service.ts). Recomputed from waiting_charge_config
--     + OLD."arrivedAt", mirroring calculateWaitingCharge() in
--     lib/fare-calculator.ts exactly.
--   - (not completed/cancelled) -> cancelled: rider-side cancellation sets
--     `cancellationFee` (hooks/useRideStore.ts). Recomputed from
--     cancellation_fee_config + OLD."acceptedAt"/"arrivedAt", mirroring
--     calculateCancellationFee() in lib/cancellation-calculator.ts exactly.
-- Every other financial/distance column is fully immutable to a non-service
-- caller, unconditionally — no legitimate client path touches them after
-- ride creation (which now goes exclusively through rides.create, running as
-- service_role — see supabase-schema-rides-server-authoritative-fare.sql).
--
-- platformCommissionRate/platformCommissionAmount/driverEarningsAmount are a
-- special case: they're deliberately NOT touched by this trigger while
-- NEW."status" is being set to 'completed' or 'cancelled' — rides_settle_guard
-- fires immediately after this trigger in the same UPDATE statement and
-- unconditionally overwrites them with the authoritative calculation, so
-- whatever a client sends for these three columns during a genuine
-- settlement transition is moot. Outside a settlement transition (i.e. no
-- legitimate reason for these to ever change), they're fully immutable.
-- ============================================================

create or replace function public.rides_protect_financial_columns()
returns trigger
language plpgsql as $$
declare
  v_wait_grace numeric;
  v_wait_rate numeric;
  v_free_window numeric;
  v_after_accept numeric;
  v_after_arrival numeric;
  v_is_waiting_transition boolean;
  v_is_cancel_transition boolean;
  v_is_settling boolean;
begin
  if auth.role() = 'service_role' then
    return NEW;
  end if;

  v_is_waiting_transition := (OLD."status" = 'accepted' and NEW."status" = 'in-progress');
  v_is_cancel_transition := (OLD."status" not in ('completed', 'cancelled') and NEW."status" = 'cancelled');
  v_is_settling := (NEW."status" in ('completed', 'cancelled'));

  -- Columns with no legitimate post-creation client write path at all.
  if NEW."baseFare" is distinct from OLD."baseFare"
     or NEW."minFare" is distinct from OLD."minFare"
     or NEW."maxFare" is distinct from OLD."maxFare"
     or NEW."bookingFee" is distinct from OLD."bookingFee"
     or NEW."serviceFee" is distinct from OLD."serviceFee"
     or NEW."zoneFee" is distinct from OLD."zoneFee"
     or NEW."priorityFee" is distinct from OLD."priorityFee"
     or NEW."distance" is distinct from OLD."distance"
     or NEW."duration" is distinct from OLD."duration"
     or NEW."fareAdjustmentPercent" is distinct from OLD."fareAdjustmentPercent"
     or NEW."paymentStatus" is distinct from OLD."paymentStatus"
  then
    raise exception 'rides.%: this field can only be set by the server', NEW."id";
  end if;

  -- Commission/earnings snapshot: left alone during a genuine settlement
  -- transition (rides_settle_guard overwrites it authoritatively right
  -- after this trigger runs); blocked otherwise.
  if not v_is_settling then
    if NEW."platformCommissionRate" is distinct from OLD."platformCommissionRate"
       or NEW."platformCommissionAmount" is distinct from OLD."platformCommissionAmount"
       or NEW."driverEarningsAmount" is distinct from OLD."driverEarningsAmount"
    then
      raise exception 'rides.%: commission/earnings can only change when a ride settles', NEW."id";
    end if;
  end if;

  -- waitingCharge: recomputed server-side on the one recognized transition,
  -- immutable otherwise.
  if v_is_waiting_transition then
    select "graceMinutes", "perMinuteRate" into v_wait_grace, v_wait_rate
      from public.waiting_charge_config limit 1;
    NEW."waitingCharge" := case
      when OLD."arrivedAt" is not null then
        greatest(0, round((extract(epoch from (now() - OLD."arrivedAt")) / 60
          - coalesce(v_wait_grace, 3)) * coalesce(v_wait_rate, 40), 2))
      else 0
    end;
  elsif NEW."waitingCharge" is distinct from OLD."waitingCharge" then
    raise exception 'rides.%: waitingCharge can only be set by the server on trip start', NEW."id";
  end if;

  -- cancellationFee: recomputed server-side on the one recognized transition,
  -- immutable otherwise.
  if v_is_cancel_transition then
    select "freeWindowSeconds", "afterAcceptFee", "afterArrivalFee"
      into v_free_window, v_after_accept, v_after_arrival
      from public.cancellation_fee_config limit 1;
    NEW."cancellationFee" := case
      when OLD."acceptedAt" is null or OLD."status" = 'pending' then 0
      when extract(epoch from (now() - OLD."acceptedAt")) <= coalesce(v_free_window, 60) then 0
      when OLD."arrivedAt" is not null then coalesce(v_after_arrival, 500)
      else coalesce(v_after_accept, 200)
    end;
  elsif NEW."cancellationFee" is distinct from OLD."cancellationFee" then
    raise exception 'rides.%: cancellationFee can only be set by the server on cancellation', NEW."id";
  end if;

  -- fare: immutable except the two recognized transitions, where it's bumped
  -- by exactly the server-recomputed waitingCharge, or replaced by the
  -- server-recomputed cancellationFee (a cancelled ride's payable amount IS
  -- the cancellation fee — mirrors hooks/useRideStore.ts's cancelRide()).
  if v_is_waiting_transition then
    NEW."fare" := coalesce(OLD."fare", 0) + NEW."waitingCharge";
  elsif v_is_cancel_transition then
    NEW."fare" := NEW."cancellationFee";
  elsif NEW."fare" is distinct from OLD."fare" then
    raise exception 'rides.%: fare can only be set by the server', NEW."id";
  end if;

  return NEW;
end;
$$;

drop trigger if exists rides_protect_financial_columns_guard on public.rides;
create trigger rides_protect_financial_columns_guard
  before update on public.rides
  for each row execute function public.rides_protect_financial_columns();
