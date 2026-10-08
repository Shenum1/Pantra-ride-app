# Database migrations

`supabase/migrations/` is the only source of truth for the database schema. Every change is a
migration file here. Nothing is pasted into the Supabase SQL editor any more.

The repo is linked to the **Pantra Ride** project (`cymdmoprlwfpkczwqhxr`), which is production.
There is no staging project: changes are tested on a local database in Docker first.

## Make a schema change

1. Create the file: `bunx supabase migration new <short_name>` and write the SQL. Make it
   re-runnable where you can (`if not exists`, `drop policy if exists` before `create policy`).
2. Test it locally:
   ```
   bunx supabase start -x imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
   bunx supabase db reset        # rebuilds the local database from all migrations + seed.sql
   ```
   `db reset` only ever touches the local database.
3. Open a PR. The **Database migrations** workflow rebuilds a database from scratch and fails if
   any migration doesn't apply.
4. Apply it to production, at the moment the matching app/backend release goes out:
   ```
   bunx supabase migration list   # what production has vs. what's in this folder
   bunx supabase db push          # lists the pending migrations and asks before applying
   ```

Never edit a migration that production already has. Write a new one that changes it.

## How this started (2026-10-08)

- `20261008000000_baseline.sql` is a snapshot of production taken that day, covering every
  file in `database/schemas/` up to `supabase-schema-users-role-lockdown.sql`. It is marked as
  applied on production with `supabase migration repair` and never runs there.
- `database/schemas/` is history. Don't run those files. Some unit tests still read them.

## Pending on production: wave 1 release

These were not on production at the 2026-10-08 snapshot. `db push` applies them in this order:

| Migration | Notes |
|---|---|
| `…0100_security_hardening` | Release the matching app build at the same time: older builds lose the driver map, ride requests and accept. |
| `…0200_chat_read_access` | New. Production has no read rules on chat tables, so chat can't load. |
| `…0300_realtime_publication` | New. Production publishes no tables to realtime, so live ride/chat/driver updates never arrive. |
| `…0400_backend_hardening` | Then run `bun scripts/backfill-bank-account-encryption.ts --dry-run`, then without `--dry-run`, then deploy the backend. |
| `…0500_policy_acceptances` | |
| `…0600_rider_privacy` | |

**Held back on purpose:** `database/schemas/supabase-schema-bank-accounts-drop-plaintext.sql`.
It deletes the plaintext bank account numbers, so it must only run after the backfill succeeds
and a backup is taken. When that's done, copy it into a new migration
(`bunx supabase migration new bank_accounts_drop_plaintext`) and push it on its own.
