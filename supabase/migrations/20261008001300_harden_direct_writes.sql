-- ============================================================
-- Close the holes found by the direct-write audit (2026-10-09)
-- ============================================================
-- The phones talk to some tables directly, so any signed-in user can send their own
-- requests. Each attack below was reproduced against a copy of production's schema
-- before this fix (see supabase/tests/database/direct_writes.test.sql):
--
--   1. A driver backdated rides."arrivedAt", then started the trip: the waiting charge
--      is computed from it (a 1,000 fare became 8,080). Arrival / start / accept /
--      complete / cancel times are now the DATABASE's clock, set once.
--   2. A rider could change a booked ride: move the dropoff while the fare stayed
--      locked, change the ride class, switch on priority without paying, change the
--      payment method, or pick their own driver. Those are now fixed at booking.
--   3. A rider could delete their promo-use record and reuse a one-time promo code.
--      Promo usage is now written by the backend only.
--   4. Anyone (even logged out) could rate any driver any number of times with made-up
--      ride ids. Ratings must now come from the rider of a completed ride, for that
--      ride's driver, once.
--   5. increment_promo_use could be called by anyone, logged in or not.
--   6. Drivers and riders could write their own rating / totalRatings / totalRides.
--   7. A driver could invent online sessions (their times are now the database's).
--   8. The logged-out role (anon) and signed-in role held write / truncate / maintain
--      privileges that only row security was holding back.
--
-- These rules apply ONLY to direct writes from the apps (database roles authenticated and
-- anon). The backend (service role) and the database's own trusted functions such as
-- accept_ride and submit_rating run as their owner and are unaffected. Where the app
-- legitimately re-sends a value (the rider app re-sends driverId and arrivedAt on
-- every update), the value is corrected silently instead of rejected, so existing app
-- builds keep working. Re-runnable.
-- ============================================================

-- True for a write coming straight from a phone, false for the backend and for trusted
-- SECURITY DEFINER functions (inside which current_user is the function's owner).
create or replace function public.is_client_session()
returns boolean
language sql
stable
as $$
  select current_user in ('authenticated', 'anon');
$$;

-- 1 + 2. Rides --------------------------------------------------------------------------------------
create or replace function public.rides_protect_definition_columns()
returns trigger
language plpgsql
as $$
begin
  if not public.is_client_session() then
    return NEW;
  end if;

  -- What was booked never changes (the fare was priced for exactly this).
  if NEW."userId" is distinct from OLD."userId"
     or NEW."pickupLocation" is distinct from OLD."pickupLocation"
     or NEW."dropoffLocation" is distinct from OLD."dropoffLocation"
     or NEW."pickupAddress" is distinct from OLD."pickupAddress"
     or NEW."dropoffAddress" is distinct from OLD."dropoffAddress"
     or NEW."rideType" is distinct from OLD."rideType"
     or NEW."isPriority" is distinct from OLD."isPriority"
     or NEW."isShared" is distinct from OLD."isShared"
     or NEW."sharedWith" is distinct from OLD."sharedWith"
     or NEW."paymentMethod" is distinct from OLD."paymentMethod"
     or NEW."promoCode" is distinct from OLD."promoCode"
     or NEW."passengerName" is distinct from OLD."passengerName"
     or NEW."passengerPhone" is distinct from OLD."passengerPhone"
     or NEW."scheduledTime" is distinct from OLD."scheduledTime"
     or NEW."scheduled_for" is distinct from OLD."scheduled_for"
  then
    raise exception 'rides.%: the details of a booked ride cannot be changed', NEW."id";
  end if;

  -- Only accept_ride (a trusted function) assigns a driver and stamps acceptance. The rider
  -- app re-sends driverId on every update, so a client value is ignored, not rejected.
  NEW."driverId" := OLD."driverId";
  NEW."acceptedAt" := OLD."acceptedAt";

  -- The rating a rider gave the driver is written only by submit_rating (the driver app builds the
  -- driver's dashboard and trip history from it). No app writes it directly.
  NEW."driverRating" := OLD."driverRating";

  -- Arrival is stamped once, with the database clock, and only while a driver is on the way.
  -- (The waiting charge is computed from it.) Later writes keep the first value.
  if OLD."arrivedAt" is not null then
    NEW."arrivedAt" := OLD."arrivedAt";
  elsif NEW."arrivedAt" is not null then
    if OLD."status" = 'accepted' and OLD."driverId" is not null then
      NEW."arrivedAt" := now();
    else
      NEW."arrivedAt" := null;
    end if;
  end if;

  -- Start / completion / cancellation times: the database clock at the moment of the change.
  NEW."startedAt" := case
    when OLD."startedAt" is not null then OLD."startedAt"
    when NEW."status" = 'in-progress' and OLD."status" is distinct from 'in-progress' then now()
    else null end;
  NEW."completedAt" := case
    when OLD."completedAt" is not null then OLD."completedAt"
    when NEW."status" = 'completed' and OLD."status" is distinct from 'completed' then now()
    else null end;
  NEW."cancelledAt" := case
    when OLD."cancelledAt" is not null then OLD."cancelledAt"
    when NEW."status" = 'cancelled' and OLD."status" is distinct from 'cancelled' then now()
    else null end;

  return NEW;
end;
$$;

drop trigger if exists rides_protect_definition_columns on public.rides;
create trigger rides_protect_definition_columns
  before update on public.rides
  for each row execute function public.rides_protect_definition_columns();

-- 6. Reputation numbers are computed by the database, never written by the apps ----------------------
create or replace function public.drivers_protect_reputation_columns()
returns trigger
language plpgsql
as $$
begin
  if not public.is_client_session() then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    NEW."rating" := null;
    NEW."totalRatings" := 0;
    NEW."totalRides" := 0;
    NEW."ratingDistribution" := '{"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}'::jsonb;
  else
    -- The app re-sends these inside whole-profile writes; keep the stored values.
    NEW."rating" := OLD."rating";
    NEW."totalRatings" := OLD."totalRatings";
    NEW."totalRides" := OLD."totalRides";
    NEW."ratingDistribution" := OLD."ratingDistribution";
  end if;
  return NEW;
end;
$$;

drop trigger if exists drivers_protect_reputation_columns on public.drivers;
create trigger drivers_protect_reputation_columns
  before insert or update on public.drivers
  for each row execute function public.drivers_protect_reputation_columns();

create or replace function public.users_protect_reputation_columns()
returns trigger
language plpgsql
as $$
begin
  if not public.is_client_session() then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    NEW."rating" := null;
    NEW."totalRatings" := 0;
  else
    NEW."rating" := OLD."rating";
    NEW."totalRatings" := OLD."totalRatings";
  end if;
  return NEW;
end;
$$;

drop trigger if exists users_protect_reputation_columns on public.users;
create trigger users_protect_reputation_columns
  before insert or update on public.users
  for each row execute function public.users_protect_reputation_columns();

-- 7. Online sessions use the database clock -----------------------------------------------------------
create or replace function public.driver_online_sessions_server_clock()
returns trigger
language plpgsql
as $$
begin
  if not public.is_client_session() then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    NEW."startedAt" := now();
    NEW."endedAt" := null;
  else
    NEW."startedAt" := OLD."startedAt";
    NEW."endedAt" := case
      when OLD."endedAt" is not null then OLD."endedAt"
      when NEW."endedAt" is not null then now()
      else null end;
  end if;
  return NEW;
end;
$$;

drop trigger if exists driver_online_sessions_server_clock on public.driver_online_sessions;
create trigger driver_online_sessions_server_clock
  before insert or update on public.driver_online_sessions
  for each row execute function public.driver_online_sessions_server_clock();

-- 3 + 5. Promo usage: read-only for users; the backend records it -------------------------------------
drop policy if exists "user_promo_uses_own" on public.user_promo_uses;
drop policy if exists "user_promo_uses_read_own" on public.user_promo_uses;
create policy "user_promo_uses_read_own"
  on public.user_promo_uses for select
  to authenticated
  using (auth.uid()::text = "userId");

revoke insert, update, delete on table public.user_promo_uses from anon, authenticated;
revoke execute on function public.increment_promo_use(uuid) from public, anon, authenticated;

-- 4. Ratings: only the rider of a completed ride can rate that ride's driver, once ---------------------
create or replace function public.submit_rating(
  p_ride_id text,
  p_driver_id uuid,
  p_rating numeric,
  p_comment text default null,
  p_tags text[] default null
)
returns public.ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rating public.ratings;
  v_avg numeric;
  v_count integer;
  v_distribution jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be between 1 and 5';
  end if;

  if p_ride_id is null
     or p_ride_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or not exists (
       select 1 from public.rides r
       where r."id" = p_ride_id::uuid
         and r."userId" = auth.uid()
         and r."driverId" = p_driver_id
         and r."status" = 'completed'
     )
  then
    raise exception 'You can only rate the driver of a completed ride you took';
  end if;

  -- Two submissions for the same ride at the same moment can't both pass the check below.
  perform pg_advisory_xact_lock(hashtext('rating:' || p_ride_id || ':' || auth.uid()::text));

  if exists (select 1 from public.ratings where "rideId" = p_ride_id and "userId" = auth.uid()) then
    raise exception 'Rating already submitted for this ride';
  end if;

  insert into public.ratings ("rideId", "userId", "driverId", "rating", "comment", "tags")
  values (p_ride_id, auth.uid(), p_driver_id, p_rating, p_comment, p_tags)
  returning * into v_rating;

  select avg("rating"), count(*) into v_avg, v_count
  from public.ratings where "driverId" = p_driver_id;

  select jsonb_build_object(
    '1', count(*) filter (where "rating" = 1),
    '2', count(*) filter (where "rating" = 2),
    '3', count(*) filter (where "rating" = 3),
    '4', count(*) filter (where "rating" = 4),
    '5', count(*) filter (where "rating" = 5)
  ) into v_distribution
  from public.ratings where "driverId" = p_driver_id;

  update public.drivers
  set "rating" = round(v_avg, 1), "totalRatings" = v_count, "ratingDistribution" = v_distribution
  where "id" = p_driver_id;

  update public.rides set "driverRating" = p_rating where "id" = p_ride_id::uuid;

  return v_rating;
end;
$$;

create or replace function public.submit_rider_rating(
  p_ride_id text,
  p_user_id uuid,
  p_rating numeric,
  p_comment text default null,
  p_tags text[] default null
)
returns public.driver_ratings_of_riders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid;
  v_rating public.driver_ratings_of_riders;
  v_avg numeric;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be between 1 and 5';
  end if;

  select "id" into v_driver_id from public.drivers where "userId" = auth.uid();
  if v_driver_id is null then
    raise exception 'Only drivers can rate riders';
  end if;

  if p_ride_id is null
     or p_ride_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or not exists (
       select 1 from public.rides r
       where r."id" = p_ride_id::uuid
         and r."driverId" = v_driver_id
         and r."userId" = p_user_id
         and r."status" = 'completed'
     )
  then
    raise exception 'You can only rate the rider of a completed ride you drove';
  end if;

  perform pg_advisory_xact_lock(hashtext('rider-rating:' || p_ride_id || ':' || v_driver_id::text));

  if exists (select 1 from public.driver_ratings_of_riders where "rideId" = p_ride_id and "driverId" = v_driver_id) then
    raise exception 'Rating already submitted for this ride';
  end if;

  insert into public.driver_ratings_of_riders ("rideId", "driverId", "userId", "rating", "comment", "tags")
  values (p_ride_id, v_driver_id, p_user_id, p_rating, p_comment, p_tags)
  returning * into v_rating;

  select avg("rating"), count(*) into v_avg, v_count
  from public.driver_ratings_of_riders where "userId" = p_user_id;

  update public.users
  set "rating" = round(v_avg, 1), "totalRatings" = v_count
  where "uid" = p_user_id;

  return v_rating;
end;
$$;

-- 8. Privileges: logged-out users and signed-in users keep only what the apps need ---------------------
-- Logged-out callers have no business with these (they also check the caller inside).
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('add_wallet_transaction', 'create_tip', 'submit_rating', 'submit_rider_rating')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end $$;

-- Row security was the only thing stopping logged-out users from writing, and stops nobody
-- from TRUNCATE / MAINTAIN, which it doesn't cover. The apps never need any of these.
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v')
  loop
    execute format('revoke insert, update, delete, truncate, references, trigger, maintain on table public.%I from anon', t.relname);
    execute format('revoke truncate, references, trigger, maintain on table public.%I from authenticated', t.relname);
  end loop;
end $$;

-- 9. A settled ride stays settled --------------------------------------------------------------------------
-- Found while testing ratings: production's settlement trigger (rides_settle_trigger, last redefined by
-- the cash-commission migration) rejected EVERY update to a completed ride, including the rating the rider
-- submits, so rating a real ride failed. It also did not stop a settled ride's status from being changed
-- to something non-terminal, so a rider could reopen a completed ride (completed -> pending) and then
-- cancel it, and the cancellation returned the reward points they had paid with.
-- Below is the live function, unchanged except for that one terminal-state check.
CREATE OR REPLACE FUNCTION "public"."rides_settle_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_rate numeric;
  v_metered_fare numeric;
  v_commission numeric;
  v_is_cash boolean;
begin
  if OLD."status" in ('completed', 'cancelled') then
    -- A settled ride's status can never change: not re-settled, and not reopened (completed ->
    -- pending, then cancelled, would hand back reward points for a ride that was taken and paid).
    -- Other harmless updates, such as the rider's rating, are allowed.
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

-- Points are only returned for a ride that was never completed (belt and braces; the lock above already
-- makes completed -> cancelled impossible).
create or replace function public.rides_return_points_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW."status" = 'cancelled'
     and OLD."status" is distinct from 'cancelled'
     and OLD."status" is distinct from 'completed'
     and coalesce(NEW."pointsUsed", 0) > 0
  then
    perform public.refund_ride_points(NEW."id");
  end if;
  return NEW;
end;
$$;
