-- ============================================================
-- Pantra Ride App — Saved Locations Schema (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql (does not touch
-- existing tables/policies).
-- ============================================================

-- 1. SAVED LOCATIONS table — Home / Work / Favorite places per user
create table if not exists public.saved_locations (
  "id"        uuid primary key default gen_random_uuid(),
  "userId"    uuid references public.users("uid") on delete cascade,
  "name"      text not null,
  "address"   text not null,
  "latitude"  numeric not null,
  "longitude" numeric not null,
  "type"      text check ("type" in ('home','work','favorite')) not null,
  "icon"      text,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);

-- 2. INDEXES
create index if not exists idx_saved_locations_userId on public.saved_locations("userId");

-- 3. ROW LEVEL SECURITY
alter table public.saved_locations enable row level security;

create policy "Users can read own saved locations"
  on public.saved_locations for select using (auth.uid() = "userId");
create policy "Users can insert own saved locations"
  on public.saved_locations for insert with check (auth.uid() = "userId");
create policy "Users can update own saved locations"
  on public.saved_locations for update using (auth.uid() = "userId");
create policy "Users can delete own saved locations"
  on public.saved_locations for delete using (auth.uid() = "userId");
