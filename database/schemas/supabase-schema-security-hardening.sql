-- ============================================================
-- Pantra Ride App — Security Hardening: drivers / pending rides / messaging
-- (additive, idempotent migration — safe to re-run)
-- Run this in: Supabase Dashboard > SQL Editor > New query
--
-- RUN AFTER (it references columns/tables/triggers these create):
--   supabase-schema.sql
--   supabase-schema-driver-pending-rides.sql      (policy dropped here)
--   supabase-schema-driver-accept-rides.sql       (policy dropped here)
--   supabase-schema-driver-verification-v2.sql    (verificationStatus, own-row
--                                                  update policy + protection
--                                                  triggers, kept unchanged)
--   supabase-schema-ride-passenger.sql            (passengerName/passengerPhone)
--   supabase-schema-ride-declines.sql             (ride_declines)
--   supabase-schema-ride-fees.sql, -ride-zone-fees.sql, -ride-waiting-charge.sql,
--   supabase-schema-pricing-config.sql            (fee/priority columns returned
--                                                  by get_pending_rides_for_driver)
--   supabase-schema-ratings.sql                   (drivers.totalRatings)
--   supabase-schema-rider-account.sql             (rider_preferences — rider
--                                                  photo hidden when Profile
--                                                  Visibility is off)
--   supabase-schema-surge-config.sql              (surge counts RPC is only
--                                                  useful once it exists)
--
-- DEPLOY ORDER: run this migration together with (ideally just before) the app
-- release that calls the new RPCs. An older app build keeps working for
-- messaging and its own driver row, but its rider map (direct drivers read),
-- driver "Available Rides" list (direct pending-rides read) and ride accept
-- (direct rides update) stop working once this runs.
--
-- Admin pages are unaffected: the backend uses the service-role key, which
-- bypasses RLS entirely.
--
-- What this closes (from the RLS audit):
--
--  1. public.drivers was readable by everyone, including logged-out users
--     ("Anyone can read drivers" using (true)) — every column: email, phone,
--     live location, fullLegalName, dateOfBirth, licenseNumber, VIN, engine
--     number, pushToken, rejectionReason, earnings...
--     Now:
--       - anon: no access at all (table privileges revoked).
--       - a driver: full SELECT of their own row only. The own-row UPDATE
--         policy and the verification-column protection triggers from
--         supabase-schema-driver-verification-v2.sql are NOT touched.
--       - riders: only a fixed set of public-facing fields of VERIFIED drivers,
--         through two SECURITY DEFINER functions:
--           get_nearby_drivers(lat, lng, radius)  -> online VERIFIED drivers
--                                                    near a point (map), no phone
--           get_ride_driver(ride_id)              -> the driver assigned to the
--                                                    caller's own ride; phone and
--                                                    live location only while that
--                                                    ride is accepted/in-progress
--
--  2. Any account with ANY drivers row (even unverified) could read every
--     pending ride, including passengerName/passengerPhone and (via the users
--     join) the rider's phone.
--     Now:
--       - the "Drivers can read pending rides" SELECT policy is dropped; drivers
--         read the marketplace through get_pending_rides_for_driver(), which
--         returns rows ONLY to a VERIFIED driver and returns NO passenger name,
--         passenger phone, rider name, rider phone, rider photo or rider id.
--       - the "Drivers can accept pending rides" UPDATE policy is dropped (it let
--         any drivers row update any pending ride, and an unfiltered UPDATE would
--         have hit every pending ride at once); acceptance goes through
--         accept_ride(ride_id), which atomically claims one still-pending,
--         unassigned ride for the calling VERIFIED driver and only then returns
--         the rider/passenger contact details to that one driver.
--       - get_ride_rider_for_driver(ride_id) re-reads those details later, but
--         only for the driver assigned to that ride (phones only while active).
--       - realtime: drivers can no longer subscribe to public.rides for pending
--         rows (no SELECT on them), so a tiny public.pending_ride_signals table
--         (rideId + timestamp only) is kept in sync by trigger and published for
--         realtime; verified drivers subscribe to it and re-fetch via the RPC.
--
--  3. Messaging: messages UPDATE was using (true) (anyone could rewrite anyone's
--     message text), and messages/conversations INSERT were with check (true)
--     (anyone could inject messages into any conversation, as anyone).
--     Now:
--       - conversations INSERT: only a participant (the rider userId, or the
--         driver whose drivers.id is driverId), and the conversation must be tied
--         to a ride that actually pairs that rider with that driver.
--       - conversations UPDATE: participants only, must stay participants, and a
--         trigger makes id/userId/driverId/rideId/createdAt immutable.
--       - messages INSERT: only a participant, only as themselves (senderType
--         must match their side, senderId must be their own id), unread.
--       - messages UPDATE: only the RECIPIENT, and a trigger restricts the change
--         to flipping "read" from false to true (what markMessagesAsRead does).
--       - messages DELETE: still no policy (denied).
--
--  Plus: get_marketplace_demand_counts() — aggregate counts only — replaces the
--  rider app's direct count queries on drivers/rides for surge pricing, which
--  the tightened policies would otherwise silently zero out.
--
-- Does NOT touch: users.role, sync_user_roles, handle_new_user or the users
-- INSERT policy (see supabase-schema-users-role-lockdown.sql).
-- ============================================================


-- ============================================================
-- 0. Logged-out (anon) clients get no table access at all to these tables.
--    RLS would already deny most of it once section 1 lands; revoking the
--    privileges as well means a future permissive policy can't re-open them.
-- ============================================================
revoke all on table public.drivers       from anon;
revoke all on table public.rides         from anon;
revoke all on table public.conversations from anon;
revoke all on table public.messages      from anon;


-- ============================================================
-- 1. DRIVERS — own row only; riders go through restricted functions
-- ============================================================
drop policy if exists "Anyone can read drivers" on public.drivers;

drop policy if exists "Driver can read own row" on public.drivers;
create policy "Driver can read own row"
  on public.drivers for select
  to authenticated
  using (auth.uid() = "userId");

-- NOTE: "Driver can update own row" and "Allow driver insert" (both redefined by
-- supabase-schema-driver-verification-v2.sql) and the triggers
-- trg_protect_driver_verification_columns / trg_enforce_driver_verified_before_online
-- are intentionally left exactly as they are.

-- The ONLY vehicle attributes a rider may see. drivers.vehicle is a free-form jsonb
-- blob, so it is rebuilt key-by-key rather than passed through (anything else that
-- ever lands in it — VIN, notes — stays private).
create or replace function public.driver_public_vehicle(p_vehicle jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case when p_vehicle is null then null else jsonb_strip_nulls(jsonb_build_object(
    'make',         p_vehicle->'make',
    'model',        p_vehicle->'model',
    'year',         p_vehicle->'year',
    'color',        p_vehicle->'color',
    'licensePlate', p_vehicle->'licensePlate',
    'type',         p_vehicle->'type'
  )) end;
$$;

-- Numeric lat/lng out of the location jsonb (the app writes {latitude, longitude};
-- legacy code wrote {lat, lng}). Returns null instead of raising on a malformed
-- value so one bad row can never break the map for every rider.
create or replace function public.location_coord(p_location jsonb, p_key text)
returns double precision
language sql
immutable
set search_path = public
as $$
  select case
    when p_key = 'latitude' and jsonb_typeof(p_location->'latitude') = 'number' then (p_location->>'latitude')::double precision
    when p_key = 'latitude' and jsonb_typeof(p_location->'lat') = 'number' then (p_location->>'lat')::double precision
    when p_key = 'longitude' and jsonb_typeof(p_location->'longitude') = 'number' then (p_location->>'longitude')::double precision
    when p_key = 'longitude' and jsonb_typeof(p_location->'lng') = 'number' then (p_location->>'lng')::double precision
    else null
  end;
$$;

-- 1a. Nearby drivers for the rider map. Online + VERIFIED only, public fields only,
--     NO phone (a rider only ever gets a phone number for their own assigned driver,
--     via get_ride_driver below). Radius capped at 50 km, result capped at 50 rows.
create or replace function public.get_nearby_drivers(
  p_latitude  double precision,
  p_longitude double precision,
  p_radius_km double precision default 10
)
returns table (
  "id"                 uuid,
  "name"               text,
  "profileImage"       text,
  "rating"             numeric,
  "totalRatings"       integer,
  "location"           jsonb,
  "vehicle"            jsonb,
  "vehicleCategory"    text,
  "vehiclePlateNumber" text,
  "isOnline"           boolean,
  "verificationStatus" text,
  "distanceKm"         double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with candidates as (
    select d.*,
           public.location_coord(d."location", 'latitude')  as lat,
           public.location_coord(d."location", 'longitude') as lng
    from public.drivers d
    where auth.uid() is not null
      and d."isOnline" = true
      and d."verificationStatus" = 'VERIFIED'
      and d."location" is not null
  ),
  measured as (
    select c.*,
           6371 * 2 * asin(least(1, sqrt(
             power(sin(radians(c.lat - p_latitude) / 2), 2) +
             cos(radians(p_latitude)) * cos(radians(c.lat)) *
             power(sin(radians(c.lng - p_longitude) / 2), 2)
           ))) as dist
    from candidates c
    where c.lat is not null and c.lng is not null
  )
  select m."id",
         m."name",
         m."profileImage",
         m."rating",
         m."totalRatings",
         jsonb_build_object('latitude', m.lat, 'longitude', m.lng),
         public.driver_public_vehicle(m."vehicle"),
         m."vehicleCategory",
         m."vehiclePlateNumber",
         m."isOnline",
         m."verificationStatus",
         m.dist
  from measured m
  where p_latitude is not null and p_longitude is not null
    and m.dist <= least(greatest(coalesce(p_radius_km, 10), 0), 50)
  order by m.dist
  limit 50;
$$;

-- 1b. The driver assigned to one of the CALLER's own rides. Phone number and live
--     location are only returned while that ride is active (accepted / in-progress);
--     after it ends the rider still sees name/vehicle/rating (receipts, tipping,
--     rating) but no longer the phone or where the driver is.
create or replace function public.get_ride_driver(p_ride_id uuid)
returns table (
  "id"                 uuid,
  "name"               text,
  "profileImage"       text,
  "rating"             numeric,
  "totalRatings"       integer,
  "location"           jsonb,
  "vehicle"            jsonb,
  "vehicleCategory"    text,
  "vehiclePlateNumber" text,
  "isOnline"           boolean,
  "verificationStatus" text,
  "phone"              text,
  "rideStatus"         text
)
language sql
stable
security definer
set search_path = public
as $$
  select d."id",
         d."name",
         d."profileImage",
         d."rating",
         d."totalRatings",
         case when r."status" in ('accepted', 'in-progress') then d."location" end,
         public.driver_public_vehicle(d."vehicle"),
         d."vehicleCategory",
         d."vehiclePlateNumber",
         d."isOnline",
         d."verificationStatus",
         case when r."status" in ('accepted', 'in-progress') then d."phone" end,
         r."status"
  from public.rides r
  join public.drivers d on d."id" = r."driverId"
  where r."id" = p_ride_id
    and auth.uid() is not null
    and r."userId" = auth.uid();
$$;


-- ============================================================
-- 2. PENDING RIDES — verified drivers only, no passenger contact until accepted
-- ============================================================
drop policy if exists "Drivers can read pending rides" on public.rides;
drop policy if exists "Drivers can accept pending rides" on public.rides;

-- Unchanged and still in force: "Rider can read own rides" (rider + assigned driver
-- SELECT) and "Rider or driver can update ride" (rider + assigned driver UPDATE),
-- plus every BEFORE UPDATE trigger on rides (financial-column protection, settle
-- guard, terminal-status lock, cash dispatch guard, verified-on-accept).

-- 2a. The marketplace list for the calling driver. Returns rows ONLY if the caller's
--     own drivers row is VERIFIED. Deliberately omits: userId, passengerName,
--     passengerPhone and every users column except the rider's rating.
--     Rides this driver already declined are filtered out server-side.
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
    and me."verificationStatus" = 'VERIFIED'
    and not exists (
      select 1 from public.ride_declines rd
      where rd."rideId" = r."id" and rd."driverId" = me."id"
    )
  order by r."createdAt" desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- 2b. Rider/passenger contact details for a ride, ONLY for the driver assigned to it.
--     Names are always returned to that driver (trip screen, rating the rider);
--     phone numbers only while the ride is active (accepted / in-progress).
create or replace function public.get_ride_rider_for_driver(p_ride_id uuid)
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
language sql
stable
security definer
set search_path = public
as $$
  select r."id",
         r."userId",
         u."displayName",
         case when r."status" in ('accepted', 'in-progress') then u."phoneNumber" end,
         -- Hidden when the rider turned off Profile Visibility (app/privacy.tsx).
         case when coalesce(p."profileVisibility", true) then u."photoURL" end,
         u."rating",
         r."passengerName",
         case when r."status" in ('accepted', 'in-progress') then r."passengerPhone" end,
         r."status"
  from public.rides r
  join public.drivers me on me."id" = r."driverId"
  left join public.users u on u."uid" = r."userId"
  left join public.rider_preferences p on p."userId" = r."userId"
  where r."id" = p_ride_id
    and auth.uid() is not null
    and me."userId" = auth.uid();
$$;

-- 2c. Accept a pending ride. Atomic: only succeeds if the ride is STILL pending and
--     unassigned (a second driver racing for the same ride gets RIDE_NOT_AVAILABLE),
--     and only for a VERIFIED driver. All rides BEFORE UPDATE triggers still run
--     (auth.uid()/auth.role() inside them still reflect the calling driver's JWT,
--     so e.g. CASH_RIDES_PAUSED and the financial-column guard behave as before).
--     Returns the rider/passenger contact details — the first moment they are
--     revealed to any driver.
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
     and r."driverId" is null;

  if not found then
    raise exception 'RIDE_NOT_AVAILABLE: this ride was already taken or cancelled';
  end if;

  return query select * from public.get_ride_rider_for_driver(p_ride_id);
end;
$$;

-- 2d. Realtime signal for drivers. Drivers can no longer subscribe to pending rows
--     of public.rides (they have no SELECT on them), so this table mirrors only
--     WHICH rides are currently pending — no addresses, no fare, no passenger — and
--     is published for realtime. Verified drivers subscribe and re-fetch the list
--     via get_pending_rides_for_driver().
create table if not exists public.pending_ride_signals (
  "rideId"      uuid primary key references public.rides("id") on delete cascade,
  "signalledAt" timestamptz not null default now()
);

alter table public.pending_ride_signals enable row level security;
revoke all on table public.pending_ride_signals from anon;
revoke insert, update, delete, truncate on table public.pending_ride_signals from authenticated;

drop policy if exists "Verified drivers can read pending ride signals" on public.pending_ride_signals;
create policy "Verified drivers can read pending ride signals"
  on public.pending_ride_signals for select
  to authenticated
  using (
    exists (
      select 1 from public.drivers d
      where d."userId" = auth.uid() and d."verificationStatus" = 'VERIFIED'
    )
  );
-- No write policy: only the trigger below (SECURITY DEFINER) writes here.

create or replace function public.rides_sync_pending_ride_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW."status" = 'pending' and NEW."driverId" is null then
    insert into public.pending_ride_signals ("rideId", "signalledAt")
    values (NEW."id", now())
    on conflict ("rideId") do update set "signalledAt" = excluded."signalledAt";
  else
    delete from public.pending_ride_signals where "rideId" = NEW."id";
  end if;
  return NEW;
end;
$$;

drop trigger if exists rides_sync_pending_ride_signal on public.rides;
create trigger rides_sync_pending_ride_signal
  after insert or update of "status", "driverId" on public.rides
  for each row execute function public.rides_sync_pending_ride_signal();

-- Backfill: bring the signal table in line with the rides that are pending right now.
delete from public.pending_ride_signals s
where not exists (
  select 1 from public.rides r
  where r."id" = s."rideId" and r."status" = 'pending' and r."driverId" is null
);
insert into public.pending_ride_signals ("rideId", "signalledAt")
select r."id", coalesce(r."createdAt", now())
from public.rides r
where r."status" = 'pending' and r."driverId" is null
on conflict ("rideId") do nothing;

-- Publish for realtime (only if Supabase's publication exists and the table isn't
-- in it yet — keeps this re-runnable).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'pending_ride_signals'
     )
  then
    alter publication supabase_realtime add table public.pending_ride_signals;
  end if;
end $$;

-- 2e. Platform-wide demand counts for the rider app's surge calculation (it used to
--     count drivers/rides rows directly, which these policies now hide). Aggregates
--     only — no row is ever returned.
create or replace function public.get_marketplace_demand_counts(p_lookback_minutes integer default 60)
returns table (
  "onlineDrivers"  integer,
  "pendingRides"   integer,
  "acceptedRecent" integer,
  "declinedRecent" integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.drivers d
      where d."isOnline" = true and d."verificationStatus" = 'VERIFIED')::integer,
    (select count(*) from public.rides r
      where r."status" = 'pending' and r."driverId" is null)::integer,
    (select count(*) from public.rides r
      where r."acceptedAt" >= now() - make_interval(mins => least(greatest(coalesce(p_lookback_minutes, 60), 1), 1440)))::integer,
    (select count(*) from public.ride_declines rd
      where rd."declinedAt" >= now() - make_interval(mins => least(greatest(coalesce(p_lookback_minutes, 60), 1), 1440)))::integer
  where auth.uid() is not null;
$$;


-- ============================================================
-- 3. MESSAGING — participants only, as themselves; read-flag-only updates
-- ============================================================

-- 3a. conversations INSERT: caller must be one side of the conversation, and the
--     conversation must be tied to a ride that really pairs this rider with this
--     driver (stops a rider opening a chat with an arbitrary driver, or a driver
--     with an arbitrary rider). The rides subquery runs under the caller's own RLS,
--     which already limits it to rides they are the rider or assigned driver of.
drop policy if exists "Participants can insert conversations" on public.conversations;
create policy "Participants can insert conversations"
  on public.conversations for insert
  to authenticated
  with check (
    (
      auth.uid() = conversations."userId"
      or exists (
        select 1 from public.drivers d
        where d."id" = conversations."driverId" and d."userId" = auth.uid()
      )
    )
    and conversations."rideId" is not null
    and exists (
      select 1 from public.rides r
      where r."id" = conversations."rideId"
        and r."userId" = conversations."userId"
        and r."driverId" = conversations."driverId"
    )
  );

-- 3b. conversations UPDATE: participants only (unchanged), and they must still be a
--     participant afterwards. sendMessage/markMessagesAsRead only touch
--     lastMessage / lastMessageTime / unreadCount* / updatedAt.
drop policy if exists "Participants can update conversations" on public.conversations;
create policy "Participants can update conversations"
  on public.conversations for update
  to authenticated
  using (
    auth.uid() = conversations."userId"
    or exists (
      select 1 from public.drivers d
      where d."id" = conversations."driverId" and d."userId" = auth.uid()
    )
  )
  with check (
    auth.uid() = conversations."userId"
    or exists (
      select 1 from public.drivers d
      where d."id" = conversations."driverId" and d."userId" = auth.uid()
    )
  );

-- Identity columns of a conversation never change from a client session.
create or replace function public.conversations_protect_identity_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return NEW;
  end if;

  if NEW."id" is distinct from OLD."id"
     or NEW."userId" is distinct from OLD."userId"
     or NEW."driverId" is distinct from OLD."driverId"
     or NEW."rideId" is distinct from OLD."rideId"
     or NEW."createdAt" is distinct from OLD."createdAt"
  then
    raise exception 'Conversation participants and ride cannot be changed.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists conversations_protect_identity_columns on public.conversations;
create trigger conversations_protect_identity_columns
  before update on public.conversations
  for each row execute function public.conversations_protect_identity_columns();

-- 3c. messages INSERT: a participant, sending as themselves, unread.
--       senderType 'user'   -> caller is conversations.userId and senderId = auth.uid()
--       senderType 'driver' -> caller owns the drivers row conversations.driverId and
--                              senderId is that drivers.id (what the app sends) or
--                              the driver's own auth uid
drop policy if exists "Participants can send messages" on public.messages;
create policy "Participants can send messages"
  on public.messages for insert
  to authenticated
  with check (
    coalesce(messages."read", false) = false
    and exists (
      select 1 from public.conversations c
      where c."id" = messages."conversationId"
        and (
          (
            messages."senderType" = 'user'
            and messages."senderId" = auth.uid()
            and c."userId" = auth.uid()
          )
          or (
            messages."senderType" = 'driver'
            and exists (
              select 1 from public.drivers d
              where d."id" = c."driverId"
                and d."userId" = auth.uid()
                and messages."senderId" in (d."id", d."userId")
            )
          )
        )
    )
  );

-- 3d. messages UPDATE: only the RECIPIENT of a message (the other side from its
--     senderType), and the trigger below allows nothing but read false -> true.
drop policy if exists "Participants can update messages" on public.messages;
drop policy if exists "Recipient can mark messages read" on public.messages;
create policy "Recipient can mark messages read"
  on public.messages for update
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c."id" = messages."conversationId"
        and (
          (messages."senderType" = 'driver' and c."userId" = auth.uid())
          or (
            messages."senderType" = 'user'
            and exists (
              select 1 from public.drivers d
              where d."id" = c."driverId" and d."userId" = auth.uid()
            )
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c."id" = messages."conversationId"
        and (
          (messages."senderType" = 'driver' and c."userId" = auth.uid())
          or (
            messages."senderType" = 'user'
            and exists (
              select 1 from public.drivers d
              where d."id" = c."driverId" and d."userId" = auth.uid()
            )
          )
        )
    )
  );

create or replace function public.messages_restrict_update()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return NEW;
  end if;

  -- Every column except "read" must be unchanged (compared as jsonb so a column
  -- added to messages later is covered automatically).
  if (to_jsonb(NEW) - 'read') is distinct from (to_jsonb(OLD) - 'read') then
    raise exception 'Only the read flag of a message can be changed.';
  end if;

  if coalesce(OLD."read", false) = true and coalesce(NEW."read", false) = false then
    raise exception 'A read message cannot be marked unread.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists messages_restrict_update on public.messages;
create trigger messages_restrict_update
  before update on public.messages
  for each row execute function public.messages_restrict_update();


-- ============================================================
-- 4. Function privileges — logged-in users only (Supabase grants EXECUTE on new
--    public functions to anon by default, so revoke it explicitly).
-- ============================================================
revoke all on function public.get_nearby_drivers(double precision, double precision, double precision) from public, anon;
revoke all on function public.get_ride_driver(uuid)                                                from public, anon;
revoke all on function public.get_pending_rides_for_driver(integer)                                from public, anon;
revoke all on function public.get_ride_rider_for_driver(uuid)                                      from public, anon;
revoke all on function public.accept_ride(uuid)                                                    from public, anon;
revoke all on function public.get_marketplace_demand_counts(integer)                               from public, anon;
revoke all on function public.rides_sync_pending_ride_signal()                                     from public, anon, authenticated;

grant execute on function public.get_nearby_drivers(double precision, double precision, double precision) to authenticated;
grant execute on function public.get_ride_driver(uuid)                                                to authenticated;
grant execute on function public.get_pending_rides_for_driver(integer)                                to authenticated;
grant execute on function public.get_ride_rider_for_driver(uuid)                                      to authenticated;
grant execute on function public.accept_ride(uuid)                                                    to authenticated;
grant execute on function public.get_marketplace_demand_counts(integer)                               to authenticated;


-- ============================================================
-- HOW TO VERIFY AFTER RUNNING (as an admin in the SQL editor; read-only queries)
-- ============================================================
--
-- -- 1. Policies now on the four tables. Expect:
-- --    drivers:  "Driver can read own row" (SELECT), "Driver can update own row",
-- --              "Allow driver insert" — and NO "Anyone can read drivers".
-- --    rides:    NO "Drivers can read pending rides" / "Drivers can accept pending rides".
-- --    messages: "Participants can read messages", "Participants can send messages",
-- --              "Recipient can mark messages read" — and NO "Participants can update messages".
-- --    No policy should show qual = 'true' or with_check = 'true' on these tables.
-- select tablename, policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('drivers', 'rides', 'conversations', 'messages', 'pending_ride_signals')
-- order by tablename, cmd, policyname;
--
-- -- 2. anon has no table privileges on these tables (expect 0 rows).
-- select table_name, privilege_type
-- from information_schema.role_table_grants
-- where grantee = 'anon'
--   and table_schema = 'public'
--   and table_name in ('drivers', 'rides', 'conversations', 'messages', 'pending_ride_signals');
--
-- -- 3. The new functions: SECURITY DEFINER, pinned search_path, and executable by
-- --    authenticated but NOT anon (expect anon_can_execute = false on every row).
-- select p.proname,
--        p.prosecdef as security_definer,
--        p.proconfig as settings,
--        has_function_privilege('anon', p.oid, 'execute')          as anon_can_execute,
--        has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('get_nearby_drivers', 'get_ride_driver', 'get_pending_rides_for_driver',
--                     'get_ride_rider_for_driver', 'accept_ride', 'get_marketplace_demand_counts');
--
-- -- 4. The functions never expose private columns (expect 0 rows).
-- select p.proname, a.name
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace,
-- lateral unnest(p.proargnames) as a(name)
-- where n.nspname = 'public'
--   and p.proname in ('get_nearby_drivers', 'get_pending_rides_for_driver')
--   and a.name in ('email', 'phone', 'pushToken', 'licenseNumber', 'vehicleVin',
--                  'vehicleEngineNumber', 'dateOfBirth', 'fullLegalName', 'rejectionReason',
--                  'passengerName', 'passengerPhone', 'userId', 'riderPhone', 'riderName');
--
-- -- 5. Triggers in place (expect 3 rows).
-- select event_object_table, trigger_name
-- from information_schema.triggers
-- where trigger_schema = 'public'
--   and trigger_name in ('rides_sync_pending_ride_signal',
--                        'conversations_protect_identity_columns',
--                        'messages_restrict_update')
-- group by event_object_table, trigger_name;
--
-- -- 6. pending_ride_signals mirrors the pending rides and is published for realtime.
-- select (select count(*) from public.pending_ride_signals) as signals,
--        (select count(*) from public.rides where "status" = 'pending' and "driverId" is null) as pending_rides,
--        exists (select 1 from pg_publication_tables
--                where pubname = 'supabase_realtime' and tablename = 'pending_ride_signals') as in_realtime;
--
-- -- 7. Simulate a logged-out client inside a rolled-back transaction (expect an
-- --    error "permission denied for table drivers").
-- begin;
--   set local role anon;
--   select count(*) from public.drivers;
-- rollback;
--
-- -- 8. Simulate a specific signed-in user (replace the uuid with a real RIDER's
-- --    auth uid). Expect 0 rows from drivers (a rider has no drivers row) and 0
-- --    rows from get_pending_rides_for_driver (not a verified driver), while
-- --    get_nearby_drivers returns only public columns.
-- begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
--   select count(*) from public.drivers;
--   select count(*) from public.get_pending_rides_for_driver(20);
--   select * from public.get_nearby_drivers(6.5244, 3.3792, 10) limit 5;
-- rollback;
