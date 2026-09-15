-- ============================================================
-- Pantra Ride App — Lock Down Legacy drivers.earnings (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema-driver-verification-v2.sql.
--
-- Pre-Phase-1.1 verification finding: drivers.earnings (a JSONB column,
-- {today,thisWeek,thisMonth,total}) is set to all-zeros exactly once at
-- driver-profile creation (lib/firebase-driver-service.ts createDriver) and
-- is NEVER written again by any application code anywhere — it is dead,
-- legacy data. It is NOT authoritative for anything financial:
-- get_driver_available_balance() (supabase-schema-driver-payouts.sql) sums
-- rides.driverEarningsAmount instead, and app/driver-earnings.tsx has been
-- fixed in this pass to read the same live stats aggregation everywhere
-- else already used, rather than this stale field.
--
-- Because it's not authoritative, this is NOT a fund-draining vulnerability
-- and does not require a large migration. It's locked down purely so a
-- driver's own client session can never write an arbitrary value into their
-- own profile's "earnings" JSON — closing the theoretical gap defensively,
-- consistent with every other Phase-1 column lockdown, even though no
-- payout calculation would ever trust it either way.
--
-- Reuses the existing protect_driver_verification_columns() trigger
-- (supabase-schema-driver-verification-v2.sql) rather than adding a new
-- one — same service-role bypass, same "list of columns no client session
-- may touch" pattern, one more column added to that list. The function name
-- no longer perfectly describes its scope (it protects one non-verification
-- column too now); renaming it would touch the DROP/CREATE TRIGGER pairing
-- for no functional benefit, so it's left as-is with this note instead.
-- ============================================================

create or replace function public.protect_driver_verification_columns()
returns trigger language plpgsql security definer as $$
begin
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
     or new."earnings" is distinct from old."earnings"
  then
    raise exception 'This field can only be changed by the server.';
  end if;

  return new;
end;
$$;
