-- ============================================================
-- Pantra Ride App — Simplified Driver Registration (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema-driver-verification-v2.sql. Safe to re-run.
--
-- Registration is now 8 photos (profile photo, driver's license, NIN, vehicle
-- exterior, vehicle license certificate, roadworthiness, 2 interior photos) plus a
-- few typed vehicle fields. This migration:
--   1. Allows the 4 new document types in driver_documents.type.
--   2. Makes those 8 the required set for every state and vehicle category.
--   3. Stops requiring drivers_license_back, insurance and proof_of_ownership (the
--      types stay valid, so old rows are untouched and they can be re-required later).
-- Nothing is dropped. Removed form fields (license number, VIN, etc.) remain as
-- nullable columns on public.drivers.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Allow the new document types
-- ------------------------------------------------------------
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

alter table public.driver_documents add constraint driver_documents_type_check
  check ("type" in (
    'license','insurance','registration','background_check','vehicle_inspection',
    'drivers_license_front','drivers_license_back','driver_selfie',
    'vehicle_registration','proof_of_ownership','roadworthiness',
    'national_id','vehicle_exterior','vehicle_interior_front','vehicle_interior_rear'
  ));

-- ------------------------------------------------------------
-- 2. Required set: the 8 registration documents, every state x category
--    (same 36 states + FCT as constants/nigerian-states.ts). Placeholder baseline,
--    not a researched per-state requirement.
-- ------------------------------------------------------------
insert into public.driver_verification_requirements ("state", "vehicleCategory", "documentType", "isRequired", "isActive")
select s.state, c.category, d.doc, true, true
from unnest(array[
  'Abia','Abuja (FCT)','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa',
  'Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu',
  'Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara',
  'Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers',
  'Sokoto','Taraba','Yobe','Zamfara'
]) as s(state)
cross join unnest(array['standard','comfort','xl']) as c(category)
cross join unnest(array[
  'driver_selfie','drivers_license_front','national_id',
  'vehicle_exterior','vehicle_registration','roadworthiness',
  'vehicle_interior_front','vehicle_interior_rear'
]) as d(doc)
on conflict ("state","vehicleCategory","documentType")
do update set "isRequired" = true, "isActive" = true, "updatedAt" = now();

-- ------------------------------------------------------------
-- 3. No longer required at registration
-- ------------------------------------------------------------
update public.driver_verification_requirements
set "isRequired" = false, "isActive" = false, "updatedAt" = now()
where "documentType" in ('drivers_license_back', 'insurance', 'proof_of_ownership');
