-- Tracks which driver declined which pending ride, so a declined ride stops
-- appearing on that driver's "Available Rides" list permanently (survives
-- app restart), without affecting the ride for other drivers — this is a
-- pull-model marketplace where multiple drivers can see the same pending
-- ride until one of them accepts it.
create table if not exists public.ride_declines (
  "rideId"     uuid not null references public.rides("id") on delete cascade,
  "driverId"   uuid not null references public.drivers("id") on delete cascade,
  "declinedAt" timestamptz default now(),
  primary key ("rideId", "driverId")
);

alter table public.ride_declines enable row level security;

create policy "Driver can read own declines"
  on public.ride_declines for select using (
    exists (select 1 from public.drivers where "id" = "driverId" and "userId" = auth.uid())
  );

create policy "Driver can insert own declines"
  on public.ride_declines for insert with check (
    exists (select 1 from public.drivers where "id" = "driverId" and "userId" = auth.uid())
  );
