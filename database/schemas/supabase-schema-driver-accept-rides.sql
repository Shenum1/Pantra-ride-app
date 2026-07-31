-- The existing "Rider or driver can update ride" policy checks driverId against the
-- CURRENT row (pre-update) — so a driver accepting a pending ride can never match it,
-- since driverId is still null at that point (same class of bug as the pending-rides
-- SELECT policy fixed earlier). No driver could ever successfully accept a ride without
-- this: the UPDATE was silently failing every time.
create policy "Drivers can accept pending rides"
  on public.rides for update using (
    "status" = 'pending' and
    exists (select 1 from public.drivers where "userId" = auth.uid())
  )
  with check (
    "driverId" in (select "id" from public.drivers where "userId" = auth.uid())
  );
