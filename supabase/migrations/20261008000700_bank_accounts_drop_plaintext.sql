-- Migration copy of database/schemas/supabase-schema-bank-accounts-drop-plaintext.sql.
-- Applied to production only after confirming both bank account tables had 0 rows needing
-- encryption (checked 2026-10-08). The guard below still refuses if any plaintext-only row exists.
-- Applied with `supabase db push`, not the SQL editor.

-- ============================================================
-- Pantra Ride App — Drop plaintext bank account numbers (POST-BACKFILL ONLY)
-- Run this in: Supabase Dashboard > SQL Editor > New query
--
-- !! DESTRUCTIVE. Run ONLY after, in order:
--   1. supabase-schema-backend-hardening.sql
--   2. bun scripts/backfill-bank-account-encryption.ts  (exited 0)
--   3. the backend build that no longer reads "accountNumber" is deployed
--      (payout-processor / admin reveal read accountNumberEncrypted only)
--
-- Drops the legacy plaintext "accountNumber" column from
-- driver_bank_accounts and wallet_bank_accounts. Each drop is guarded: if
-- ANY row still has plaintext but no ciphertext, the whole migration raises
-- and nothing is dropped (the DO block runs in one transaction).
--
-- Idempotent: once a column is gone, its guard and drop are skipped.
-- Take a backup / point-in-time snapshot first — this cannot be undone.
-- ============================================================

do $$
declare
  t text;
  unencrypted bigint;
begin
  foreach t in array array['driver_bank_accounts', 'wallet_bank_accounts'] loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'accountNumber'
    ) then
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = t and column_name = 'accountNumberEncrypted'
      ) then
        raise exception '%: "accountNumberEncrypted" column missing — run supabase-schema-backend-hardening.sql / the encryption migration first. Nothing dropped.', t;
      end if;

      execute format(
        'select count(*) from public.%I where "accountNumber" is not null and "accountNumberEncrypted" is null',
        t
      ) into unencrypted;

      if unencrypted > 0 then
        raise exception '%: % row(s) still have a plaintext accountNumber and no accountNumberEncrypted. Run scripts/backfill-bank-account-encryption.ts first. Nothing dropped.', t, unencrypted;
      end if;
    end if;
  end loop;

  -- All guards passed — drop.
  foreach t in array array['driver_bank_accounts', 'wallet_bank_accounts'] loop
    execute format('alter table public.%I drop column if exists "accountNumber"', t);
  end loop;
end
$$;
