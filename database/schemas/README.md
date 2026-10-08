# Historical SQL files: do not run

These files were run by hand in the Supabase SQL editor until 2026-10-08. The schema now lives
in `supabase/migrations/` (see `supabase/README.md`). The baseline migration there already
contains everything production had on that date.

Kept for history and because some unit tests in `testing/unit/` read them. New schema changes
go in `supabase/migrations/`, never here.

The one exception still waiting: `supabase-schema-bank-accounts-drop-plaintext.sql` becomes a
migration after the bank account encryption backfill has run (see `supabase/README.md`).
