-- ============================================================
-- Pantra Ride App — Money Precision Hardening (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql, supabase-schema-wallet.sql,
-- supabase-schema-tips.sql, supabase-schema-ride-commission-snapshot.sql,
-- supabase-schema-ride-fees.sql, supabase-schema-ride-zone-fees.sql,
-- supabase-schema-ride-waiting-charge.sql (priorityFee column),
-- supabase-schema-cancellation-fees.sql, supabase-schema-fare-negotiation.sql,
-- supabase-schema-platform-commission-config.sql.
--
-- Most financial columns in this schema are unscaled `numeric` — no
-- guaranteed decimal precision, so JS floating-point noise (e.g.
-- 2709 * 0.1 === 270.90000000000003) can be persisted verbatim. This
-- narrows every NGN monetary column to NUMERIC(12,2) (kobo precision, up to
-- ~₦10 billion — far beyond any realistic single-ride/wallet amount) and
-- rounds the commission calculation server-side to match (see the
-- rides_settle_trigger() redefinition below, and calculateDriverPayout in
-- lib/fare-calculator.ts for the matching TS-side fix).
--
-- "platformCommissionRate" is a ratio (e.g. 0.1000), not money — narrowed to
-- NUMERIC(6,4) instead. distance/duration are not monetary — untouched.
-- ============================================================

alter table public.rides
  alter column "fare" type numeric(12,2),
  alter column "baseFare" type numeric(12,2),
  alter column "minFare" type numeric(12,2),
  alter column "maxFare" type numeric(12,2),
  alter column "bookingFee" type numeric(12,2),
  alter column "serviceFee" type numeric(12,2),
  alter column "zoneFee" type numeric(12,2),
  alter column "waitingCharge" type numeric(12,2),
  alter column "priorityFee" type numeric(12,2),
  alter column "cancellationFee" type numeric(12,2),
  alter column "offeredFare" type numeric(12,2),
  alter column "platformCommissionAmount" type numeric(12,2),
  alter column "driverEarningsAmount" type numeric(12,2),
  alter column "platformCommissionRate" type numeric(6,4);

alter table public.wallets alter column "balance" type numeric(12,2);
alter table public.wallet_transactions alter column "amount" type numeric(12,2);
alter table public.tips alter column "amount" type numeric(12,2);

-- Matching rounding fix to rides_settle_trigger(): round the commission to
-- kobo precision BEFORE deriving driverEarnings from it (never round the two
-- independently — that's what keeps commission + driverEarnings reconciling
-- exactly to the metered fare). This is the same function most recently
-- defined in supabase-schema-platform-commission-config.sql; this
-- CREATE OR REPLACE supersedes it again, changing only the two
-- `v_commission := ... * v_rate;` lines to wrap them in round(..., 2).
create or replace function public.rides_settle_trigger()
returns trigger
language plpgsql as $$
declare
  v_rate numeric;
  v_metered_fare numeric;
  v_commission numeric;
begin
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
    v_commission := round(v_metered_fare * v_rate, 2);

    NEW."platformCommissionRate" := v_rate;
    NEW."platformCommissionAmount" := v_commission;
    NEW."driverEarningsAmount" := coalesce(NEW."fare", 0) - v_commission;
  end if;

  if NEW."status" = 'cancelled' and coalesce(NEW."cancellationFee", 0) > 0 then
    select "rate" into v_rate from public.platform_commission_config limit 1;
    v_rate := coalesce(v_rate, 0.1);
    v_commission := round(coalesce(NEW."cancellationFee", 0) * v_rate, 2);
    NEW."platformCommissionRate" := v_rate;
    NEW."platformCommissionAmount" := v_commission;
    NEW."driverEarningsAmount" := coalesce(NEW."cancellationFee", 0) - v_commission;
  end if;

  return NEW;
end;
$$;
