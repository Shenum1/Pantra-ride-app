-- ============================================================
-- Pantra Ride App — Explicit Fare Source (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema-rides-protect-financial-columns.sql.
--
-- Pre-Phase-1.1, rides.create had a silent Haversine fallback for distance
-- whenever Google Directions was unreachable — meaning a fare could be
-- authoritative and financially settled while actually being derived from a
-- straight-line estimate, materially different from real road distance,
-- with no trace of which happened. That fallback has been removed entirely
-- (backend/lib/directions-service.ts now throws rather than estimating).
--
-- This column makes the provenance of every ride's fare explicit and
-- auditable going forward. Existing rows predate this concept and are left
-- NULL (unknown/legacy) — NOT backfilled to 'google_directions', since some
-- of them may genuinely have been created from the old Haversine fallback
-- and it would misrepresent history to claim otherwise.
-- ============================================================

alter table public.rides add column if not exists "fareSource" text;

-- Locked down the same way as every other authoritative fare field: only
-- the service-role client (rides.create) may set it, and never after
-- creation. Re-declares rides_protect_financial_columns() with "fareSource"
-- added to the unconditionally-immutable column list — see
-- supabase-schema-rides-protect-financial-columns.sql for the full function
-- and the reasoning behind each column group.
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
     or NEW."fareSource" is distinct from OLD."fareSource"
  then
    raise exception 'rides.%: this field can only be set by the server', NEW."id";
  end if;

  if not v_is_settling then
    if NEW."platformCommissionRate" is distinct from OLD."platformCommissionRate"
       or NEW."platformCommissionAmount" is distinct from OLD."platformCommissionAmount"
       or NEW."driverEarningsAmount" is distinct from OLD."driverEarningsAmount"
    then
      raise exception 'rides.%: commission/earnings can only change when a ride settles', NEW."id";
    end if;
  end if;

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
