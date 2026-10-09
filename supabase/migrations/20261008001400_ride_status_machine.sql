-- ============================================================
-- Ride status is a one-way state machine, and cancellations are logged
-- ============================================================
-- Before this, any rider or driver on a ride could write any status. The rider app even
-- mirrors the status it hears from the database using a possibly stale local copy, so
-- stale writes could drag a ride backwards. Real consequences found in the audit:
--   * A rider could regress an accepted ride to 'pending' and then cancel it. The
--     cancellation-fee logic returns 0 for a ride cancelled from 'pending', so the
--     driver's cancellation fee was dodged.
--   * Payment could be confirmed, and the ride completed, without the trip ever starting.
--
-- Flow (database statuses): pending -> accepted -> in-progress -> completed,
-- with cancelled reachable from any unsettled state.
--
-- Direct writes from the apps (roles authenticated / anon, see is_client_session()):
--   pending     -> cancelled     the rider
--   accepted    -> in-progress   the assigned driver
--   accepted    -> cancelled     the rider or the assigned driver
--   in-progress -> completed     the assigned driver
--   in-progress -> cancelled     the assigned driver only (owner decision 2026-10-09: a rider could
--                                 otherwise ride to the destination and cancel instead of paying)
-- Anything else a phone sends (a stale 'pending', a rider "completing" a trip, pending ->
-- accepted outside accept_ride) is CORRECTED silently: the status simply stays as it
-- is, so existing app builds, which re-send their local status, keep working.
--
-- Rules for EVERY session, including the backend (raised, because a backend that breaks
-- them has a bug that should be loud):
--   * a ride can only be completed from 'in-progress';
--   * payment can only be confirmed (paymentStatus -> 'paid') while the trip is in-progress.
--
-- Cancellation log (set by the database, on every cancellation, never by the apps), so the
-- state at the moment of cancellation is on record for when cancellation fees are charged:
--   "cancelledFromStatus"    pending / accepted / in-progress
--   "cancelledAfterArrival"  had the driver already arrived
--   "cancelledBy"            rider / driver / system
-- Re-runnable.
-- ============================================================

alter table public.rides
  add column if not exists "cancelledFromStatus" text,
  add column if not exists "cancelledAfterArrival" boolean,
  add column if not exists "cancelledBy" text;

-- Existing cancelled rides can't be backfilled reliably (the earlier state wasn't kept).

-- Is the signed-in user the driver with this id? Reads the drivers table as its owner, so the answer
-- does not depend on the row-security policies on drivers (a future tightening of those policies
-- must not silently make every driver's start / complete / cancel be reverted). It only ever answers
-- about the caller themselves.
create or replace function public.is_assigned_driver(p_driver_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.drivers d
      where d."id" = p_driver_id and d."userId" = auth.uid()
    );
$$;

revoke all on function public.is_assigned_driver(uuid) from public, anon;
grant execute on function public.is_assigned_driver(uuid) to authenticated, service_role;

create or replace function public.rides_enforce_status_machine()
returns trigger
language plpgsql
as $$
declare
  v_client boolean := public.is_client_session();
  v_is_rider boolean := false;
  v_is_driver boolean := false;
  v_allowed boolean := false;
begin
  -- The cancellation log is the database's alone.
  if v_client then
    NEW."cancelledFromStatus" := OLD."cancelledFromStatus";
    NEW."cancelledAfterArrival" := OLD."cancelledAfterArrival";
    NEW."cancelledBy" := OLD."cancelledBy";
  end if;

  -- A settled ride is handled by the settlement lock (rides_settle_trigger).
  if OLD."status" in ('completed', 'cancelled') then
    return NEW;
  end if;

  -- Who is writing: the ride's rider, or the driver assigned to it.
  v_is_rider := auth.uid() is not null and auth.uid() = OLD."userId";
  v_is_driver := auth.uid() is not null
    and OLD."driverId" is not null
    and public.is_assigned_driver(OLD."driverId");

  if v_client and NEW."status" is distinct from OLD."status" then
    v_allowed := case
      when OLD."status" = 'pending'     and NEW."status" = 'cancelled'   then v_is_rider
      when OLD."status" = 'accepted'    and NEW."status" = 'in-progress' then v_is_driver
      when OLD."status" = 'accepted'    and NEW."status" = 'cancelled'   then v_is_rider or v_is_driver
      when OLD."status" = 'in-progress' and NEW."status" = 'completed'   then v_is_driver
      when OLD."status" = 'in-progress' and NEW."status" = 'cancelled'   then v_is_driver
      else false
    end;

    if not v_allowed then
      NEW."status" := OLD."status";
    end if;
  end if;

  -- Rules for every session.
  if NEW."status" = 'completed' and OLD."status" is distinct from 'in-progress' then
    raise exception 'rides.%: a ride can only be completed from in-progress (it is %)', NEW."id", OLD."status";
  end if;

  if NEW."paymentStatus" = 'paid'
     and OLD."paymentStatus" is distinct from 'paid'
     and OLD."status" is distinct from 'in-progress'
  then
    raise exception 'rides.%: payment can only be confirmed while the trip is in progress (it is %)', NEW."id", OLD."status";
  end if;

  -- Log the state at the moment of cancellation.
  if NEW."status" = 'cancelled' then
    NEW."cancelledFromStatus" := OLD."status";
    NEW."cancelledAfterArrival" := (OLD."arrivedAt" is not null);
    NEW."cancelledBy" := case
      when v_is_rider then 'rider'
      when v_is_driver then 'driver'
      when auth.uid() is null then 'system'
      else 'other'
    end;
  end if;

  return NEW;
end;
$$;

-- Named so it fires first: the other ride triggers should see the corrected status
-- (for example the cash dispatch guard and the cancellation-fee logic).
drop trigger if exists rides_00_enforce_status_machine on public.rides;
create trigger rides_00_enforce_status_machine
  before update on public.rides
  for each row execute function public.rides_enforce_status_machine();
