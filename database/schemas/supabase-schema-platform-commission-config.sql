-- ============================================================
-- Pantra Ride App — Admin-Configurable Platform Commission Rate (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema-ride-payment-status.sql (redefines
-- rides_settle_trigger() via create-or-replace; does not change its trigger
-- binding, guard logic, or immutability behavior — only where v_rate comes
-- from).
-- ============================================================

-- Single-row config table, same shape/RLS convention as
-- pricing_priority_config / surge_config (supabase-schema-pricing-config.sql,
-- supabase-schema-surge-config.sql): open read, no write policy — only the
-- service-role admin routes (admin.pricing.commission.*) can write.
create table if not exists public.platform_commission_config (
  "id"        uuid primary key default gen_random_uuid(),
  "rate"      numeric not null default 0.1,
  "updatedAt" timestamptz default now()
);

alter table public.platform_commission_config enable row level security;

drop policy if exists "Anyone can read platform commission config" on public.platform_commission_config;
create policy "Anyone can read platform commission config"
  on public.platform_commission_config for select using (true);

-- Seed exactly one row at the current hardcoded rate (0.1) so behavior is
-- unchanged until an admin edits it.
insert into public.platform_commission_config ("rate")
select 0.1
where not exists (select 1 from public.platform_commission_config);

-- Redefine rides_settle_trigger() to read the rate from the table above
-- instead of a hardcoded constant. Everything else — the immutability guard,
-- the payment gate, the metered-fare formula — is unchanged from
-- supabase-schema-ride-payment-status.sql. The config lookup is placed
-- inside the two settlement branches (not at the top of the function) so it
-- only runs a query on an actual completed/chargeable-cancelled transition,
-- not on every unrelated update to a rides row (this trigger has no WHEN
-- clause and fires on every UPDATE).
create or replace function public.rides_settle_trigger()
returns trigger
language plpgsql as $$
declare
  v_rate numeric;
  v_metered_fare numeric;
  v_commission numeric;
begin
  -- Ride already settled: reject any further attempt to settle it again, and
  -- reject any direct tampering with the settlement fields, but allow
  -- unrelated columns (driverRating, etc.) to keep updating normally.
  if OLD."status" in ('completed', 'cancelled') then
    if NEW."status" in ('completed', 'cancelled') then
      raise exception 'ride % is already settled (status=%); it cannot be settled again', OLD."id", OLD."status";
    end if;

    if NEW."fare" is distinct from OLD."fare"
       or NEW."platformCommissionRate" is distinct from OLD."platformCommissionRate"
       or NEW."platformCommissionAmount" is distinct from OLD."platformCommissionAmount"
       or NEW."driverEarningsAmount" is distinct from OLD."driverEarningsAmount"
       or NEW."paymentStatus" is distinct from OLD."paymentStatus"
    then
      raise exception 'ride % is already settled; its settlement fields are immutable', OLD."id";
    end if;

    return NEW;
  end if;

  -- Fresh transition into 'completed': payment must already be confirmed.
  if NEW."status" = 'completed' then
    if NEW."paymentStatus" is distinct from 'paid' then
      raise exception 'ride % cannot be completed before payment is confirmed (paymentStatus=%)', NEW."id", NEW."paymentStatus";
    end if;

    select "rate" into v_rate from public.platform_commission_config limit 1;
    v_rate := coalesce(v_rate, 0.1);

    v_metered_fare := greatest(
      coalesce(NEW."fare", 0)
        - coalesce(NEW."bookingFee", 0)
        - coalesce(NEW."serviceFee", 0)
        - coalesce(NEW."zoneFee", 0)
        - coalesce(NEW."waitingCharge", 0)
        - coalesce(NEW."priorityFee", 0),
      0
    );
    v_commission := v_metered_fare * v_rate;

    NEW."platformCommissionRate" := v_rate;
    NEW."platformCommissionAmount" := v_commission;
    NEW."driverEarningsAmount" := coalesce(NEW."fare", 0) - v_commission;
  end if;

  -- Fresh transition into 'cancelled' with a chargeable cancellation fee
  -- settles the same way (see cancellationFee's doc comment) — not gated on
  -- paymentStatus, since cancellation fees aren't collected through the
  -- online-payment/wallet flow.
  if NEW."status" = 'cancelled' and coalesce(NEW."cancellationFee", 0) > 0 then
    select "rate" into v_rate from public.platform_commission_config limit 1;
    v_rate := coalesce(v_rate, 0.1);

    v_commission := coalesce(NEW."cancellationFee", 0) * v_rate;

    NEW."platformCommissionRate" := v_rate;
    NEW."platformCommissionAmount" := v_commission;
    NEW."driverEarningsAmount" := coalesce(NEW."cancellationFee", 0) - v_commission;
  end if;

  return NEW;
end;
$$;

drop trigger if exists rides_settle_guard on public.rides;
create trigger rides_settle_guard
  before update on public.rides
  for each row execute function public.rides_settle_trigger();
