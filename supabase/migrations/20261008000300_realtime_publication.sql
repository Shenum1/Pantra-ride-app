-- ============================================================
-- Realtime: publish the tables the app subscribes to
-- ============================================================
-- The app listens for postgres_changes on rides (ride-matching-service,
-- ride-history-service), drivers (firebase-driver-service, own row),
-- conversations and messages (messaging-service). Production's
-- supabase_realtime publication contains no tables (2026-10-08 snapshot), so
-- none of those subscriptions ever receives an event.
-- (pending_ride_signals is added by 20261008000100_security_hardening.sql.)
--
-- Realtime applies each subscriber's row level security, so a session only
-- receives changes to rows it can already SELECT. Re-runnable.
-- ============================================================

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach t in array array['rides', 'drivers', 'conversations', 'messages'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
