-- ============================================================
-- Pantra Ride App — Ratings Schema (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql (does not touch
-- existing tables/policies).
-- ============================================================

-- 1. Driver rating aggregate columns ("rating" already exists)
alter table public.drivers add column if not exists "totalRatings" integer default 0;
alter table public.drivers add column if not exists "ratingDistribution" jsonb default '{"1":0,"2":0,"3":0,"4":0,"5":0}';

-- 2. RATINGS table
create table if not exists public.ratings (
  "id"        uuid primary key default gen_random_uuid(),
  "rideId"    text not null,
  "userId"    uuid references public.users("uid") on delete cascade,
  "driverId"  uuid references public.drivers("id") on delete cascade,
  "rating"    numeric not null check ("rating" between 1 and 5),
  "comment"   text,
  "tags"      text[],
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now(),
  unique ("rideId", "userId")
);

-- 3. INDEXES
create index if not exists idx_ratings_driverId on public.ratings("driverId");
create index if not exists idx_ratings_userId   on public.ratings("userId");

-- 4. ROW LEVEL SECURITY
alter table public.ratings enable row level security;

create policy "Users can read own ratings"
  on public.ratings for select using (auth.uid() = "userId");
create policy "Drivers can read their own ratings"
  on public.ratings for select using (
    auth.uid() in (select "userId" from public.drivers where "id" = "driverId")
  );

-- 5. ATOMIC SUBMIT FUNCTION
-- Inserts the rating (rejecting duplicates for the same ride/user),
-- recomputes the driver's aggregate rating/totalRatings/ratingDistribution,
-- and (when rideId is a real ride uuid) stamps rides.driverRating — all
-- in one statement.
create or replace function public.submit_rating(
  p_ride_id text,
  p_driver_id uuid,
  p_rating numeric,
  p_comment text default null,
  p_tags text[] default null
) returns public.ratings
language plpgsql security definer as $$
declare
  v_rating public.ratings;
  v_avg numeric;
  v_count integer;
  v_distribution jsonb;
begin
  if p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be between 1 and 5';
  end if;

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

  if p_ride_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    update public.rides set "driverRating" = p_rating where "id" = p_ride_id::uuid;
  end if;

  return v_rating;
end;
$$;

grant execute on function public.submit_rating(text, uuid, numeric, text, text[]) to authenticated;
