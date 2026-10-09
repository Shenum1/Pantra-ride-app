-- ============================================================
-- A driver cannot take (or even be offered) their own ride
-- ============================================================
-- The same account can be both a rider and a driver. Nothing stopped such an account from booking
-- a ride and accepting it themselves, which makes no sense and, now that reward points pay up to half
-- of a fare out of Pantra's pocket, would let one person farm points and commission. (Owner decision,
-- 2026-10-09.)
--
-- Below are the live accept_ride() and get_pending_rides_for_driver() (from
-- 20261008000100_security_hardening.sql), copied unchanged except for ONE added condition each:
--   * accept_ride: the ride's rider must not be the caller (a refusal looks like "already taken", so
--     the app's existing RIDE_NOT_AVAILABLE message applies);
--   * get_pending_rides_for_driver: the caller's own requests are left out of their list.
-- Re-runnable.
-- ============================================================

create or replace function public.accept_ride(p_ride_id uuid)
returns table (
  "rideId"         uuid,
  "userId"         uuid,
  "riderName"      text,
  "riderPhone"     text,
  "riderPhoto"     text,
  "riderRating"    numeric,
  "passengerName"  text,
  "passengerPhone" text,
  "rideStatus"     text
)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_driver_id uuid;
  v_status    text;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select d."id", d."verificationStatus"
    into v_driver_id, v_status
  from public.drivers d
  where d."userId" = auth.uid();

  if v_driver_id is null then
    raise exception 'NOT_A_DRIVER' using errcode = '42501';
  end if;

  if v_status is distinct from 'VERIFIED' then
    -- Same wording as enforce_driver_verified_on_accept() so the app's existing
    -- error matching keeps working.
    raise exception 'Driver must be VERIFIED to accept rides.' using errcode = '42501';
  end if;

  update public.rides r
     set "driverId"   = v_driver_id,
         "status"     = 'accepted',
         "acceptedAt" = now()
   where r."id" = p_ride_id
     and r."status" = 'pending'
     and r."driverId" is null
     -- A driver cannot take their own ride (the same account can be a rider and a driver).
     and r."userId" is distinct from auth.uid();

  if not found then
    raise exception 'RIDE_NOT_AVAILABLE: this ride was already taken or cancelled';
  end if;

  return query select * from public.get_ride_rider_for_driver(p_ride_id);
end;
$$;

create or replace function public.get_pending_rides_for_driver(p_limit integer default 20)
returns table (
  "id"              uuid,
  "pickupLocation"  jsonb,
  "dropoffLocation" jsonb,
  "pickupAddress"   text,
  "dropoffAddress"  text,
  "rideType"        text,
  "fare"            numeric,
  "bookingFee"      numeric,
  "serviceFee"      numeric,
  "zoneFee"         numeric,
  "waitingCharge"   numeric,
  "priorityFee"     numeric,
  "distance"        numeric,
  "duration"        integer,
  "paymentMethod"   text,
  "isPriority"      boolean,
  "scheduledTime"   timestamptz,
  "createdAt"       timestamptz,
  "riderRating"     numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select r."id",
         r."pickupLocation",
         r."dropoffLocation",
         r."pickupAddress",
         r."dropoffAddress",
         r."rideType",
         r."fare",
         r."bookingFee",
         r."serviceFee",
         r."zoneFee",
         r."waitingCharge",
         r."priorityFee",
         r."distance",
         r."duration"::integer,
         r."paymentMethod",
         r."isPriority",
         r."scheduledTime",
         r."createdAt",
         u."rating"
  from public.drivers me
  join public.rides r
    on r."status" = 'pending'
   and r."driverId" is null
  left join public.users u on u."uid" = r."userId"
  where auth.uid() is not null
    and me."userId" = auth.uid()
    -- A driver is never offered their own ride request.
    and r."userId" is distinct from auth.uid()
    and me."verificationStatus" = 'VERIFIED'
    and not exists (
      select 1 from public.ride_declines rd
      where rd."rideId" = r."id" and rd."driverId" = me."id"
    )
  order by r."createdAt" desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
