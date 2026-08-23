-- ============================================================
-- Pantra Ride App — Driver Registration & Verification Rebuild (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql, supabase-schema-driver-documents.sql,
-- supabase-schema-driver-accept-rides.sql (does not drop any existing table/column).
--
-- Fixes the core vulnerability in supabase-schema.sql: the "Driver can update own
-- row" policy on public.drivers has no `with check` and no column restriction, so a
-- driver's own authenticated client can currently set isVerified/licenseNumber/plate
-- etc. directly, bypassing the admin review pipeline entirely. This migration:
--   1. Adds structured verification columns + a real state machine to public.drivers.
--   2. Locks every verification-relevant column down to service-role-only writes via
--      a BEFORE UPDATE trigger (RLS alone can't express column-level restriction).
--   3. Adds append-only check-result and audit-log tables (service-role write only).
--   4. Adds a per-state/per-vehicle-category required-document config table, following
--      the same "public-read config table" pattern as pricing_tier_config.
--   5. Adds triggers that block going online / accepting a ride unless the driver's
--      verificationStatus is 'VERIFIED' — enforced at the database layer regardless
--      of which application code path performs the write.
-- ============================================================

-- ------------------------------------------------------------
-- 1. public.drivers — new structured verification columns
-- ------------------------------------------------------------
alter table public.drivers add column if not exists "fullLegalName"    text;
alter table public.drivers add column if not exists "dateOfBirth"      date;
alter table public.drivers add column if not exists "operatingState"   text;
alter table public.drivers add column if not exists "vehicleCategory"  text; -- 'standard' | 'comfort' | 'xl' (reuses ride tiers, see lib/pricing-config.ts)
alter table public.drivers add column if not exists "phoneVerifiedAt"  timestamptz;
alter table public.drivers add column if not exists "emailVerifiedAt" timestamptz;
alter table public.drivers add column if not exists "licenseNumber"      text;
alter table public.drivers add column if not exists "licenseCategory"    text;
alter table public.drivers add column if not exists "licenseIssueDate"   date;
alter table public.drivers add column if not exists "licenseExpiryDate"  date;
alter table public.drivers add column if not exists "vehiclePlateNumber"  text;
alter table public.drivers add column if not exists "vehicleVin"          text;
alter table public.drivers add column if not exists "vehicleEngineNumber" text;
alter table public.drivers add column if not exists "verificationStatus" text default 'PENDING';
alter table public.drivers add column if not exists "verificationStatusUpdatedAt" timestamptz default now();
alter table public.drivers add column if not exists "rejectionReason" text;
-- "verificationProgress" already exists (added by supabase-schema-driver-documents.sql).

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.drivers'::regclass and conname = 'drivers_verificationStatus_check'
  ) then
    alter table public.drivers add constraint "drivers_verificationStatus_check"
      check ("verificationStatus" in ('PENDING','DOCUMENTS_SUBMITTED','VERIFYING','VERIFIED','REJECTED','MANUAL_REVIEW'));
  end if;
end $$;

-- Backfill: keep verificationStatus consistent with any pre-existing isVerified flag.
update public.drivers
  set "verificationStatus" = case when "isVerified" then 'VERIFIED' else 'PENDING' end
  where "verificationStatus" is null;

create index if not exists idx_drivers_verificationStatus on public.drivers("verificationStatus");

-- ------------------------------------------------------------
-- 2. public.driver_documents — widen `type` to the new document set
-- ------------------------------------------------------------
-- Drop whatever check constraint currently governs the "type" column (its name is
-- Postgres-assigned in the original migration, and this block also cleans up its own
-- previously-added constraint if this script runs more than once) before re-adding a
-- widened one — this keeps the migration idempotent without needing to know the exact
-- original constraint name ahead of time.
--
-- Finds the constraint via pg_constraint.conkey (the actual column it applies to),
-- not by string-matching pg_get_constraintdef()'s rendered text — an earlier version
-- of this block searched for a literal `"type"` (quoted) in that text, but Postgres
-- only quotes identifiers when required, so an unreserved lowercase column like
-- `type` renders unquoted and the pattern never matched. That silently left this
-- constraint un-dropped on any re-run, so the ADD CONSTRAINT below failed with
-- "constraint already exists" the second time this script was run.
do $$
declare c record;
begin
  for c in (
    select con.conname
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid
     and att.attnum = any(con.conkey)
    where con.conrelid = 'public.driver_documents'::regclass
      and con.contype = 'c'
      and att.attname = 'type'
  )
  loop
    execute format('alter table public.driver_documents drop constraint %I', c.conname);
  end loop;
end $$;

-- Old values (license/registration/vehicle_inspection/background_check) stay valid for
-- historic rows; new code only ever writes the new set. background_check is retired
-- from the required-document checklist going forward (no vendor, not in the required
-- data-point list) but old rows referencing it remain readable.
alter table public.driver_documents add constraint driver_documents_type_check
  check ("type" in (
    'license','insurance','registration','background_check','vehicle_inspection',
    'drivers_license_front','drivers_license_back','driver_selfie',
    'vehicle_registration','proof_of_ownership','roadworthiness'
  ));

-- ------------------------------------------------------------
-- 3. driver_document_verification_checks — one row per check run (append-only)
-- ------------------------------------------------------------
create table if not exists public.driver_document_verification_checks (
  "id"                 uuid primary key default gen_random_uuid(),
  "documentId"         uuid references public.driver_documents("id") on delete cascade,
  "driverId"           uuid references public.drivers("id") on delete cascade,
  "checkType"          text check ("checkType" in ('format','ocr_consistency','authenticity')),
  "status"             text check ("status" in ('pending','pass','fail','mismatch','manual_review','not_configured','error')),
  "provider"           text,
  "providerReferenceId" text,
  "resultDetails"      jsonb,
  "checkedAt"          timestamptz default now(),
  "createdAt"          timestamptz default now()
);

create index if not exists idx_ddvc_documentId on public.driver_document_verification_checks("documentId");
create index if not exists idx_ddvc_driverId   on public.driver_document_verification_checks("driverId");

alter table public.driver_document_verification_checks enable row level security;

drop policy if exists "Drivers can read own verification checks" on public.driver_document_verification_checks;
create policy "Drivers can read own verification checks"
  on public.driver_document_verification_checks for select using (
    "driverId" in (select "id" from public.drivers where "userId" = auth.uid())
  );
-- Deliberately no insert/update/delete policy: only the service-role backend writes here.

-- ------------------------------------------------------------
-- 4. driver_verification_audit_log — append-only audit trail
-- ------------------------------------------------------------
create table if not exists public.driver_verification_audit_log (
  "id"          uuid primary key default gen_random_uuid(),
  "driverId"    uuid references public.drivers("id") on delete cascade,
  "actorType"   text check ("actorType" in ('system','admin','driver')),
  "actorId"     uuid,
  "eventType"   text check ("eventType" in
     ('STATUS_CHANGED','DOCUMENT_SUBMITTED','FORMAT_CHECK_RUN','OCR_CHECK_RUN',
      'AUTHENTICITY_CHECK_RUN','ADMIN_DECISION','PHONE_VERIFIED','EMAIL_VERIFIED')),
  "fromStatus"  text,
  "toStatus"    text,
  "documentId"  uuid references public.driver_documents("id"),
  "reason"      text,
  "metadata"    jsonb,
  "createdAt"   timestamptz default now()
);

create index if not exists idx_audit_driverId on public.driver_verification_audit_log("driverId");

alter table public.driver_verification_audit_log enable row level security;

drop policy if exists "Drivers can read own audit log" on public.driver_verification_audit_log;
create policy "Drivers can read own audit log"
  on public.driver_verification_audit_log for select using (
    "driverId" in (select "id" from public.drivers where "userId" = auth.uid())
  );
-- Deliberately no write policy: only the service-role backend writes here.

-- ------------------------------------------------------------
-- 5. driver_verification_requirements — per-state/per-category required-document config
--    Same "public-read config table, service-role/dashboard writes only" pattern as
--    pricing_tier_config (see supabase-schema-pricing-config.sql).
-- ------------------------------------------------------------
create table if not exists public.driver_verification_requirements (
  "id"              uuid primary key default gen_random_uuid(),
  "state"           text not null,
  "vehicleCategory" text not null,
  "documentType"    text not null,
  "isRequired"      boolean not null default true,
  "isActive"        boolean not null default true,
  "notes"           text,
  "updatedAt"       timestamptz default now(),
  unique ("state", "vehicleCategory", "documentType")
);

alter table public.driver_verification_requirements enable row level security;

drop policy if exists "Anyone can read driver verification requirements" on public.driver_verification_requirements;
create policy "Anyone can read driver verification requirements"
  on public.driver_verification_requirements for select using (true);
-- No write policy — service role / Supabase dashboard only, same as pricing_tier_config.

-- Seed data is a PLACEHOLDER baseline checklist, not a researched per-state legal
-- checklist — flagged in the rebuild plan as needing a real regulatory pass per state
-- before launch. lib/driver-verification-config.ts's fallback mirrors this same set.
-- Covers all 36 states + FCT (constants/nigerian-states.ts) so every state a driver
-- can select during registration resolves a real requirement checklist, not just the
-- handful of states initially open for registration (see LAUNCHED_STATES).
insert into public.driver_verification_requirements ("state", "vehicleCategory", "documentType", "isRequired")
select s.state, c.category, d.doc, true
from unnest(array[
  'Abia','Abuja (FCT)','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa',
  'Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu',
  'Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara',
  'Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers',
  'Sokoto','Taraba','Yobe','Zamfara'
]) as s(state)
cross join unnest(array['standard','comfort','xl']) as c(category)
cross join unnest(array[
  'drivers_license_front','drivers_license_back','driver_selfie',
  'vehicle_registration','insurance','proof_of_ownership'
]) as d(doc)
on conflict ("state","vehicleCategory","documentType") do nothing;

-- Illustrative example of state-specific variance: roadworthiness required in
-- Lagos/FCT only. Not a researched requirement — confirm against actual state
-- regulations before relying on this in production.
insert into public.driver_verification_requirements ("state", "vehicleCategory", "documentType", "isRequired", "notes")
select s.state, c.category, 'roadworthiness', true, 'Placeholder example of state-specific variance — confirm against actual regulation.'
from unnest(array['Lagos','Abuja (FCT)']) as s(state)
cross join unnest(array['standard','comfort','xl']) as c(category)
on conflict ("state","vehicleCategory","documentType") do nothing;

-- ------------------------------------------------------------
-- 6. Lock down verification-relevant columns on public.drivers to service-role-only
--    writes. RLS `using`/`with check` can only see the whole row being written, not an
--    old-vs-new diff, so true column-level lockdown needs a BEFORE UPDATE trigger —
--    this is what actually closes the vulnerability, not the RLS policy rewrite alone.
-- ------------------------------------------------------------
drop policy if exists "Driver can update own row" on public.drivers;
create policy "Driver can update own row"
  on public.drivers for update
  using (auth.uid() = "userId")
  with check (auth.uid() = "userId");

drop policy if exists "Allow driver insert" on public.drivers;
create policy "Allow driver insert"
  on public.drivers for insert
  with check (
    auth.uid() = "userId"
    and coalesce("isVerified", false) = false
    and coalesce("verificationStatus", 'PENDING') = 'PENDING'
  );

create or replace function public.protect_driver_verification_columns()
returns trigger language plpgsql security definer as $$
begin
  -- The backend's service-role client (backend/lib/supabase-admin.ts) is the only
  -- writer permitted to touch these columns — this is the verification engine's
  -- entire authority model. Everything else (the driver's own session, any direct API
  -- call with a driver JWT) is rejected here regardless of RLS policy.
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new."isVerified" is distinct from old."isVerified"
     or new."verificationStatus" is distinct from old."verificationStatus"
     or new."verificationStatusUpdatedAt" is distinct from old."verificationStatusUpdatedAt"
     or new."verificationProgress" is distinct from old."verificationProgress"
     or new."licenseNumber" is distinct from old."licenseNumber"
     or new."licenseCategory" is distinct from old."licenseCategory"
     or new."licenseIssueDate" is distinct from old."licenseIssueDate"
     or new."licenseExpiryDate" is distinct from old."licenseExpiryDate"
     or new."vehiclePlateNumber" is distinct from old."vehiclePlateNumber"
     or new."vehicleVin" is distinct from old."vehicleVin"
     or new."vehicleEngineNumber" is distinct from old."vehicleEngineNumber"
     or new."vehicleCategory" is distinct from old."vehicleCategory"
     or new."operatingState" is distinct from old."operatingState"
     or new."phoneVerifiedAt" is distinct from old."phoneVerifiedAt"
     or new."emailVerifiedAt" is distinct from old."emailVerifiedAt"
     or new."rejectionReason" is distinct from old."rejectionReason"
  then
    raise exception 'Verification fields can only be changed by the verification engine.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_driver_verification_columns on public.drivers;
create trigger trg_protect_driver_verification_columns
  before update on public.drivers
  for each row execute function public.protect_driver_verification_columns();

-- ------------------------------------------------------------
-- 7. Ride-acceptance gating — a driver cannot go online or accept a ride unless
--    verificationStatus = 'VERIFIED'. Enforced regardless of which code path performs
--    the write (both setDriverOnlineStatus/acceptRide are direct Supabase client
--    calls today, not routed through tRPC).
-- ------------------------------------------------------------
create or replace function public.enforce_driver_verified_before_online()
returns trigger language plpgsql security definer as $$
begin
  if new."isOnline" = true and coalesce(old."isOnline", false) = false
     and coalesce(new."verificationStatus", 'PENDING') <> 'VERIFIED' then
    raise exception 'Driver must be VERIFIED before going online.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_driver_verified_before_online on public.drivers;
create trigger trg_enforce_driver_verified_before_online
  before update on public.drivers
  for each row execute function public.enforce_driver_verified_before_online();

create or replace function public.enforce_driver_verified_on_accept()
returns trigger language plpgsql security definer as $$
begin
  if old."driverId" is null and new."driverId" is not null then
    if not exists (
      select 1 from public.drivers
      where "id" = new."driverId" and "verificationStatus" = 'VERIFIED'
    ) then
      raise exception 'Driver must be VERIFIED to accept rides.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_driver_verified_on_accept on public.rides;
create trigger trg_enforce_driver_verified_on_accept
  before update on public.rides
  for each row execute function public.enforce_driver_verified_on_accept();

-- ============================================================
-- Existing "documents" Storage bucket / path convention
-- (drivers/<driverId>/<type>_<timestamp>) is reused unchanged for the new document
-- type names — no Storage bucket or policy changes needed.
-- ============================================================
