-- ============================================================
-- Pantra Ride App — Driver Verification Schema (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql (does not touch
-- existing tables/policies).
-- ============================================================

-- 1. Add verification progress tracking to drivers
alter table public.drivers add column if not exists "verificationProgress" numeric default 0;

-- 2. DRIVER DOCUMENTS table
create table if not exists public.driver_documents (
  "id"               uuid primary key default gen_random_uuid(),
  "driverId"         uuid references public.drivers("id") on delete cascade,
  "type"             text check ("type" in ('license','insurance','registration','background_check','vehicle_inspection')),
  "documentUrl"      text,
  "status"           text check ("status" in ('pending','approved','rejected')) default 'pending',
  "uploadedAt"       timestamptz default now(),
  "reviewedAt"       timestamptz,
  "reviewedBy"       uuid,
  "rejectionReason"  text,
  "expiryDate"       timestamptz,
  "createdAt"        timestamptz default now(),
  "updatedAt"        timestamptz default now()
);

-- 3. INDEXES
create index if not exists idx_driver_documents_driverId on public.driver_documents("driverId");
create index if not exists idx_driver_documents_status   on public.driver_documents("status");

-- 4. ROW LEVEL SECURITY
alter table public.driver_documents enable row level security;

create policy "Drivers can read own documents"
  on public.driver_documents for select using (
    "driverId" in (select "id" from public.drivers where "userId" = auth.uid())
  );

create policy "Drivers can upload own documents"
  on public.driver_documents for insert with check (
    "driverId" in (select "id" from public.drivers where "userId" = auth.uid())
  );

-- Note: only the service role (admin backend) can update/approve/reject documents.

-- ============================================================
-- STORAGE BUCKET (run separately in Dashboard > Storage)
-- Create bucket "documents" — Public: NO
--
-- Then run the policies below so drivers can upload/view only
-- their own files under the "drivers/<driverId>/..." path.
-- The admin backend uses the service role key, which bypasses
-- these policies entirely.
-- ============================================================

create policy "Drivers can upload to own document folder"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and (storage.foldername("name"))[1] = 'drivers'
    and (storage.foldername("name"))[2] in (select "id"::text from public.drivers where "userId" = auth.uid())
  );

create policy "Drivers can view own document folder"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and (storage.foldername("name"))[1] = 'drivers'
    and (storage.foldername("name"))[2] in (select "id"::text from public.drivers where "userId" = auth.uid())
  );
