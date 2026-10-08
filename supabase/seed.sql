-- Local only: `supabase db reset` runs this after the migrations. Never runs on production.

-- Driver documents bucket. Production's bucket was created in the dashboard, so
-- no migration creates it. Private: documents are only read through signed URLs.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
