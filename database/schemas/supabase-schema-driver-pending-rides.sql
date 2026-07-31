-- Allows any authenticated driver to see pending (unassigned) rides, so the
-- driver-side "Available Rides" list and ride-request subscription can actually
-- return rows. The existing "Rider can read own rides" policy only covers rides
-- a driver is already assigned to (driverId set) — pending rides have no driverId
-- yet, so no driver could ever see them without this.
create policy "Drivers can read pending rides"
  on public.rides for select using (
    "status" = 'pending' and
    exists (select 1 from public.drivers where "userId" = auth.uid())
  );
