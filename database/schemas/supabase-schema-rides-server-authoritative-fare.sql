-- ============================================================
-- Pantra Ride App — Server-Authoritative Ride Creation (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema.sql.
-- Run BEFORE: supabase-schema-rides-protect-financial-columns.sql.
--
-- Ride creation moves entirely behind the new rides.create backend route
-- (backend/trpc/routes/rides/create/route.ts), which computes every
-- financial/distance field server-side and inserts via the service-role
-- client. Direct client INSERTs into `rides` are no longer permitted at all:
-- dropping this policy with no replacement means RLS default-denies INSERT
-- for the authenticated/anon roles, while the service-role client (used by
-- rides.create) bypasses RLS entirely and is unaffected.
-- ============================================================

drop policy if exists "Rider can create rides" on public.rides;
