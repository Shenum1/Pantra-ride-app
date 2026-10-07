-- Rider privacy toggles (app/privacy.tsx) — make them mean something.
-- Hand-run, idempotent; apply after supabase-schema-rider-account.sql.
--
-- 1. Defaults. "Location Sharing" and "Profile Visibility" are opt-out
--    controls (on unless the rider turns them off); "Personalized Ads" stays
--    opt-in. Previously every column defaulted to false, so a row created by
--    toggling ANY preference silently stored the others as "off". Existing
--    rows are deliberately left untouched: we can't tell an explicit "off"
--    from a defaulted one, and keeping "off" is the privacy-safe reading.
--    Keep in sync with lib/privacy-preferences.ts (DEFAULT_RIDER_PRIVACY_PREFS).
alter table public.rider_preferences alter column "locationSharing" set default true;
alter table public.rider_preferences alter column "profileVisibility" set default true;

-- "Data Collection" was removed from the app (there is no analytics to switch
-- off). The column is kept so older app builds that still write it don't
-- fail; nothing reads it.
comment on column public.rider_preferences."dataCollection" is
  'Unused: toggle removed from the app (no analytics/data collection exists). Kept for old builds.';

-- 2. Profile Visibility, enforced server-side. Riders' public.users rows are
--    only readable by their owner (supabase-schema.sql), so a driver can't
--    read a rider's photo directly. This is the one sanctioned path: a
--    driver gets the photo of riders whose ride they can see (pending
--    marketplace rides, or rides assigned to them) — and NULL when the rider
--    turned Profile Visibility off.
create or replace function public.get_rider_photos_for_driver(p_rider_ids uuid[])
returns table ("uid" uuid, "photoURL" text)
language sql
stable
security definer
set search_path = public
as $$
  select u."uid",
         case when coalesce(p."profileVisibility", true) then u."photoURL" else null end
  from public.users u
  left join public.rider_preferences p on p."userId" = u."uid"
  where u."uid" = any(p_rider_ids)
    and exists (
      select 1
      from public.rides r
      where r."userId" = u."uid"
        and (
          r."status" = 'pending'
          or r."driverId" in (select d."id" from public.drivers d where d."userId" = auth.uid())
        )
    )
    and exists (select 1 from public.drivers d where d."userId" = auth.uid());
$$;

revoke all on function public.get_rider_photos_for_driver(uuid[]) from public;
revoke all on function public.get_rider_photos_for_driver(uuid[]) from anon;
grant execute on function public.get_rider_photos_for_driver(uuid[]) to authenticated;
