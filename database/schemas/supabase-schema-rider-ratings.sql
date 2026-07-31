-- ============================================================
-- Pantra Ride App — Driver-Rates-Rider Schema (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql and
-- supabase-schema-user-ratings.sql (does not touch existing
-- tables/policies).
--
-- Mirrors supabase-schema-ratings.sql (rider rates driver) in the
-- other direction: driver rates rider. Updates public.users.rating /
-- "totalRatings" the same way submit_rating() updates public.drivers.
-- ============================================================

create table if not exists public.driver_ratings_of_riders (
  "id"        uuid primary key default gen_random_uuid(),
  "rideId"    text not null,
  "driverId"  uuid references public.drivers("id") on delete cascade,
  "userId"    uuid references public.users("uid") on delete cascade,
  "rating"    numeric not null check ("rating" between 1 and 5),
  "comment"   text,
  "tags"      text[],
  "createdAt" timestamptz default now(),
  unique ("rideId", "driverId")
);

create index if not exists idx_driver_ratings_of_riders_userId   on public.driver_ratings_of_riders("userId");
create index if not exists idx_driver_ratings_of_riders_driverId on public.driver_ratings_of_riders("driverId");

alter table public.driver_ratings_of_riders enable row level security;

create policy "Riders can read ratings about themselves"
  on public.driver_ratings_of_riders for select using (auth.uid() = "userId");
create policy "Drivers can read ratings they gave"
  on public.driver_ratings_of_riders for select using (
    auth.uid() in (select "userId" from public.drivers where "id" = "driverId")
  );

create or replace function public.submit_rider_rating(
  p_ride_id text,
  p_user_id uuid,
  p_rating numeric,
  p_comment text default null,
  p_tags text[] default null
) returns public.driver_ratings_of_riders
language plpgsql security definer as $$
declare
  v_driver_id uuid;
  v_rating public.driver_ratings_of_riders;
  v_avg numeric;
  v_count integer;
begin
  if p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be between 1 and 5';
  end if;

  select "id" into v_driver_id from public.drivers where "userId" = auth.uid();
  if v_driver_id is null then
    raise exception 'Only drivers can rate riders';
  end if;

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

grant execute on function public.submit_rider_rating(text, uuid, numeric, text, text[]) to authenticated;
