-- ============================================================
-- Pantra Ride App — Users role lockdown (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema.sql, supabase-schema-user-roles.sql
--
-- Closes a hole where any user could make themselves an admin. Admin access
-- is decided by the user_roles table (backend/lib/admin-auth.ts), and three
-- client-controlled paths could put an 'admin' row there:
--   1. UPDATE their own users row to role='admin' — the "Users can update
--      own profile" policy doesn't restrict columns — and the
--      sync_user_roles trigger copied it into user_roles.
--   2. INSERT a users row with role='admin' ("Allow insert on signup" was
--      WITH CHECK (true)).
--   3. Sign up with role='admin' in the auth metadata, which
--      handle_new_user copied into users.role.
--
-- After this migration:
--   - sync_user_roles only ever syncs 'rider'/'driver'. users.role can no
--     longer grant admin by any path.
--   - Requests from the app can only create a users row as 'rider' or
--     'driver', and the only role change they can make is 'rider' ->
--     'driver' (Google driver signup does it). driver -> rider, or any other
--     change, must go through the backend or the SQL editor.
--   - handle_new_user ignores any signup role other than 'rider'/'driver'.
--   - A user can only insert their own users row.
--
-- To make someone an admin from now on (SQL editor — not restricted by this
-- migration), set BOTH:
--   update users set role = 'admin' where email = '<email>';
--   insert into user_roles ("userId", role)
--     select uid, 'admin' from users where email = '<email>';
-- admin-web's login screen checks users.role (admin-web/src/hooks/useAuth.ts);
-- the backend's admin routes check user_roles. Either one alone isn't enough.
--
-- This migration does NOT remove existing admin rows. Review them after
-- running it (query at the bottom) and delete any you don't recognise.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Never grant 'admin' from users.role
-- ----------------------------------------------------------------
create or replace function public.sync_user_roles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if NEW.role in ('rider', 'driver') then
    insert into public.user_roles ("userId", role)
    values (NEW.uid, NEW.role)
    on conflict do nothing;
  end if;
  return NEW;
end;
$$;

-- ----------------------------------------------------------------
-- 2. Requests from the app may only set role to rider/driver
-- ----------------------------------------------------------------
-- Only app requests (anon/authenticated) are restricted. The backend
-- (service_role), the SQL editor and auth-internal signup are unaffected;
-- signup is covered separately by section 3.
create or replace function public.protect_user_role() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return NEW;
  end if;

  if TG_OP = 'UPDATE' and NEW.role is not distinct from OLD.role then
    return NEW;
  end if;

  if NEW.role is not null and NEW.role not in ('rider', 'driver') then
    raise exception 'role % cannot be set from the app', NEW.role
      using errcode = '42501';
  end if;

  -- The only role change the app makes is Google driver signup moving a new
  -- account from 'rider' to 'driver' (lib/driver-auth-service.ts). Anything
  -- else (driver -> rider, clearing the role) must go through the backend.
  if TG_OP = 'UPDATE' and not (OLD.role = 'rider' and NEW.role = 'driver') then
    raise exception 'role cannot be changed from % to % from the app', OLD.role, NEW.role
      using errcode = '42501';
  end if;

  return NEW;
end;
$$;

drop trigger if exists protect_user_role_on_write on public.users;
create trigger protect_user_role_on_write
  before insert or update of role on public.users
  for each row
  execute function public.protect_user_role();

-- ----------------------------------------------------------------
-- 3. Signup: only accept rider/driver from auth metadata
-- ----------------------------------------------------------------
-- Same as the supabase-schema.sql version except the role line.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users ("uid", "email", "displayName", "photoURL", "role")
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'displayName', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    case
      when new.raw_user_meta_data->>'role' in ('rider', 'driver')
        then new.raw_user_meta_data->>'role'
      else 'rider'
    end
  )
  on conflict ("uid") do nothing;
  return new;
end;
$$;

-- ----------------------------------------------------------------
-- 4. A user can only insert their own users row
-- ----------------------------------------------------------------
-- Signup itself is handled by handle_new_user (above), which bypasses RLS.
-- The app's own profile upserts (lib/auth-service.ts) always run for the
-- signed-in user's own uid.
drop policy if exists "Allow insert on signup" on public.users;
create policy "Allow insert on signup"
  on public.users for insert with check (auth.uid() = "uid");

-- ----------------------------------------------------------------
-- After running: review every admin account
-- ----------------------------------------------------------------
-- select ur."userId", u.email, u."displayName", ur."createdAt"
--   from user_roles ur left join users u on u.uid = ur."userId"
--  where ur.role = 'admin'
--  order by ur."createdAt";
--
-- Remove one you don't recognise:
--   delete from user_roles where "userId" = '<uid>' and role = 'admin';
