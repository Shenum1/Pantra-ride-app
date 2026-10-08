-- ============================================================
-- Baseline: the production schema as of 2026-10-08
-- ============================================================
-- Generated with `supabase db dump --linked` (public schema), plus Pantra's own
-- objects in Supabase's auth and storage schemas (the signup trigger and the
-- driver document-folder policies), copied from a dump of those schemas.
--
-- Production already has everything in this file. It is marked as applied there
-- with `supabase migration repair` and is never run against production. Locally
-- (`supabase db reset`) and in CI it builds a copy of production from scratch.
--
-- Covers every file in database/schemas/ up to and including
-- supabase-schema-users-role-lockdown.sql. The 2026-10-07 wave 1 files are NOT
-- in here; they follow as separate migrations.
-- ============================================================




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."wallet_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "userId" "uuid",
    "type" "text",
    "amount" numeric(12,2) NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'completed'::"text",
    "rideId" "uuid",
    "paymentMethodId" "text",
    "reference" "text",
    "metadata" "jsonb",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "wallet_transactions_status_check" CHECK (("status" = ANY (ARRAY['completed'::"text", 'pending'::"text", 'failed'::"text"]))),
    CONSTRAINT "wallet_transactions_type_check" CHECK (("type" = ANY (ARRAY['credit'::"text", 'debit'::"text", 'refund'::"text", 'cashback'::"text", 'ride_payment'::"text", 'add_money'::"text", 'withdraw'::"text", 'tip'::"text"])))
);


ALTER TABLE "public"."wallet_transactions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_wallet_transaction"("p_user_id" "uuid", "p_type" "text", "p_amount" numeric, "p_description" "text", "p_status" "text" DEFAULT 'completed'::"text", "p_ride_id" "uuid" DEFAULT NULL::"uuid", "p_payment_method_id" "text" DEFAULT NULL::"text", "p_reference" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT NULL::"jsonb") RETURNS "public"."wallet_transactions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_balance numeric;
  v_txn public.wallet_transactions;
begin
  if auth.role() = 'service_role' then
    null;
  elsif auth.uid() = p_user_id then
    if p_type = 'withdraw' then
      raise exception 'withdrawals from a rider wallet are not supported';
    end if;
    if p_type not in ('ride_payment', 'debit') then
      raise exception 'credit/tip transactions must be issued by the backend after verification';
    end if;
    if p_amount is null or p_amount >= 0 then
      raise exception 'a rider may only debit their own wallet';
    end if;
  else
    raise exception 'not authorized';
  end if;

  insert into public.wallets ("userId", "balance")
  values (p_user_id, 0)
  on conflict ("userId") do nothing;

  select "balance" into v_balance from public.wallets where "userId" = p_user_id for update;

  if p_amount < 0 and v_balance + p_amount < 0 then
    raise exception 'insufficient balance';
  end if;

  update public.wallets
  set "balance" = "balance" + p_amount, "updatedAt" = now()
  where "userId" = p_user_id;

  begin
    insert into public.wallet_transactions
      ("userId","type","amount","description","status","rideId","paymentMethodId","reference","metadata")
    values
      (p_user_id, p_type, p_amount, p_description, p_status, p_ride_id, p_payment_method_id, p_reference, p_metadata)
    returning * into v_txn;
  exception
    when unique_violation then
      select * into v_txn
      from public.wallet_transactions
      where "reference" = p_reference and "type" = p_type
      limit 1;
  end;

  return v_txn;
end;
$$;


ALTER FUNCTION "public"."add_wallet_transaction"("p_user_id" "uuid", "p_type" "text", "p_amount" numeric, "p_description" "text", "p_status" "text", "p_ride_id" "uuid", "p_payment_method_id" "text", "p_reference" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tips" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rideId" "uuid" NOT NULL,
    "riderId" "uuid" NOT NULL,
    "driverId" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'NGN'::"text" NOT NULL,
    "paymentMethod" "text" NOT NULL,
    "paymentReference" "text",
    "idempotencyKey" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tips_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "tips_paymentMethod_check" CHECK (("paymentMethod" = 'wallet'::"text")),
    CONSTRAINT "tips_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'successful'::"text", 'failed'::"text", 'cancelled'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."tips" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_tip"("p_rider_id" "uuid", "p_ride_id" "uuid", "p_driver_id" "uuid", "p_amount" numeric, "p_payment_method" "text", "p_idempotency_key" "uuid") RETURNS "public"."tips"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_min_amount   constant numeric := 50;    -- keep in sync with TIP_CONFIG.minAmount, lib/pricing-config.ts
  v_max_amount   constant numeric := 50000; -- keep in sync with TIP_CONFIG.maxAmount, lib/pricing-config.ts
  v_window_hours constant numeric := 72;    -- keep in sync with TIP_CONFIG.windowHours, lib/pricing-config.ts
  v_ride record;
  v_wallet_txn public.wallet_transactions;
  v_tip public.tips;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized';
  end if;

  -- Idempotency short-circuit, backed by an advisory lock so two concurrent
  -- calls with the identical key (a double-tap that both got past the UI's
  -- own debounce, a retried request after a timeout) can't both pass this
  -- check and both debit the wallet — the unique index on
  -- (riderId, idempotencyKey) alone isn't enough, because by the time it
  -- would fire the wallet debit already happened and can't be undone from
  -- inside this function. Same technique already used by
  -- driver_payouts_check_balance().
  perform pg_advisory_xact_lock(hashtext(p_rider_id::text || ':' || p_idempotency_key::text));

  select * into v_tip from public.tips
  where "riderId" = p_rider_id and "idempotencyKey" = p_idempotency_key;
  if found then
    return v_tip;
  end if;

  if p_payment_method not in ('wallet') then
    raise exception 'unsupported payment method: %', p_payment_method;
  end if;

  if p_amount is null or p_amount <> trunc(p_amount) or p_amount < v_min_amount or p_amount > v_max_amount then
    raise exception 'invalid tip amount: %', p_amount;
  end if;

  select "id","userId","driverId","status","paymentStatus","completedAt"
    into v_ride from public.rides where "id" = p_ride_id for update;

  if not found then
    raise exception 'ride not found';
  end if;
  if v_ride."userId" is distinct from p_rider_id then
    raise exception 'ride does not belong to this rider';
  end if;
  if v_ride."driverId" is distinct from p_driver_id then
    raise exception 'driver does not match this ride';
  end if;
  if v_ride."status" <> 'completed' then
    raise exception 'ride is not completed';
  end if;
  if v_ride."paymentStatus" <> 'paid' then
    raise exception 'ride payment is not settled';
  end if;
  if v_ride."completedAt" is null or v_ride."completedAt" < (now() - (v_window_hours || ' hours')::interval) then
    raise exception 'tip window has closed for this ride';
  end if;
  if not exists (select 1 from public.drivers where "id" = p_driver_id) then
    raise exception 'driver not found';
  end if;

  -- The ONLY money movement a tip causes. rides.fare / platformCommission* /
  -- driverEarningsAmount are never read or written here — a tip is a
  -- separate, 100%-driver / 0%-platform transaction by construction (this
  -- function never computes a commission for it at all, not via a zero
  -- rate). Reuses the existing atomic, overdraft-safe debit; insufficient
  -- balance raises here and aborts the whole function, so no tips row and
  -- no partial debit ever result — the same idempotencyKey can then be
  -- safely retried after the rider tops up.
  select * into v_wallet_txn from public.add_wallet_transaction(
    p_rider_id, 'tip', -p_amount, 'Tip for ride ' || p_ride_id::text,
    'completed', p_ride_id, p_payment_method, p_idempotency_key::text,
    jsonb_build_object('driverId', p_driver_id)
  );

  insert into public.tips
    ("rideId","riderId","driverId","amount","currency","paymentMethod","paymentReference","idempotencyKey","status")
  values
    (p_ride_id, p_rider_id, p_driver_id, p_amount, 'NGN', p_payment_method, v_wallet_txn."id"::text, p_idempotency_key, 'successful')
  returning * into v_tip;

  return v_tip;
end;
$$;


ALTER FUNCTION "public"."create_tip"("p_rider_id" "uuid", "p_ride_id" "uuid", "p_driver_id" "uuid", "p_amount" numeric, "p_payment_method" "text", "p_idempotency_key" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."driver_payouts_check_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW."driverId"));

  IF NEW."amount" > public.get_driver_available_balance(NEW."driverId") THEN
    RAISE EXCEPTION 'payout amount % exceeds available balance', NEW."amount";
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."driver_payouts_check_balance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."driver_payouts_validate_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if NEW."status" is distinct from OLD."status" then
    if not (
      (OLD."status" = 'pending'        and NEW."status" in ('processing', 'manual_review')) or
      (OLD."status" = 'processing'     and NEW."status" in ('completed', 'failed', 'manual_review')) or
      (OLD."status" = 'manual_review'  and NEW."status" in ('processing', 'completed', 'failed')) or
      -- A 'failed' payout may only re-enter via a NEW authorized attempt
      -- (admin.payouts.retry, which re-initiates the automatic path) — never
      -- silently, and never straight to 'completed'.
      (OLD."status" = 'failed'         and NEW."status" = 'processing') or
      -- A completed payout may only ever be reversed — never resurrected
      -- into any other state.
      (OLD."status" = 'completed'      and NEW."status" = 'reversed')
    ) then
      raise exception 'driver_payouts %: invalid status transition % -> %', OLD."id", OLD."status", NEW."status";
    end if;
  end if;
  NEW."updatedAt" := now();
  return NEW;
end;
$$;


ALTER FUNCTION "public"."driver_payouts_validate_transition"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_driver_verified_before_online"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if new."isOnline" = true and coalesce(old."isOnline", false) = false
     and coalesce(new."verificationStatus", 'PENDING') <> 'VERIFIED' then
    raise exception 'Driver must be VERIFIED before going online.';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_driver_verified_before_online"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_driver_verified_on_accept"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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


ALTER FUNCTION "public"."enforce_driver_verified_on_accept"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_driver_available_balance"("driver_id" "text") RETURNS numeric
    LANGUAGE "sql" STABLE
    AS $$
  SELECT GREATEST(
    COALESCE((
      SELECT SUM(r."driverEarningsAmount")
      FROM public.rides r
      WHERE r."driverId"::text = driver_id
        AND r."status" = 'completed'
        AND r."paymentStatus" = 'paid'
    ), 0)
    + COALESCE((
      SELECT SUM(t."amount")
      FROM public.tips t
      WHERE t."driverId"::text = driver_id
        AND t."status" = 'successful'
    ), 0)
    + COALESCE((
      SELECT SUM(l."amount")
      FROM public.driver_commission_ledger l
      WHERE l."driverId"::text = driver_id
    ), 0)
    - COALESCE((
      SELECT SUM(p."amount")
      FROM public.driver_payouts p
      WHERE p."driverId" = driver_id
        AND p."status" IN ('pending', 'processing', 'manual_review', 'completed')
    ), 0),
    0
  );
$$;


ALTER FUNCTION "public"."get_driver_available_balance"("driver_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_driver_cash_debt_limit"() RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((select "cashDebtLimit" from public.platform_commission_config limit 1), 5000);
$$;


ALTER FUNCTION "public"."get_driver_cash_debt_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_driver_net_balance"("driver_id" "text") RETURNS numeric
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    COALESCE((
      SELECT SUM(r."driverEarningsAmount")
      FROM public.rides r
      WHERE r."driverId"::text = driver_id
        AND r."status" = 'completed'
        AND r."paymentStatus" = 'paid'
    ), 0)
    + COALESCE((
      SELECT SUM(t."amount")
      FROM public.tips t
      WHERE t."driverId"::text = driver_id
        AND t."status" = 'successful'
    ), 0)
    + COALESCE((
      SELECT SUM(l."amount")
      FROM public.driver_commission_ledger l
      WHERE l."driverId"::text = driver_id
    ), 0)
    - COALESCE((
      SELECT SUM(p."amount")
      FROM public.driver_payouts p
      WHERE p."driverId" = driver_id
        AND p."status" IN ('pending', 'processing', 'manual_review', 'completed')
    ), 0);
$$;


ALTER FUNCTION "public"."get_driver_net_balance"("driver_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_drivers_commission_summary"() RETURNS TABLE("driverId" "uuid", "netBalance" numeric, "totalCommission" numeric, "totalSettled" numeric, "lastSettlementAt" timestamp with time zone)
    LANGUAGE "sql" STABLE
    AS $$
  select
    l."driverId",
    public.get_driver_net_balance(l."driverId"::text),
    coalesce(-sum(l."amount") filter (where l."type" = 'cash_commission_debit'), 0),
    coalesce(sum(l."amount") filter (where l."type" = 'cash_commission_settlement'), 0),
    max(l."createdAt") filter (where l."type" = 'cash_commission_settlement')
  from public.driver_commission_ledger l
  group by l."driverId";
$$;


ALTER FUNCTION "public"."get_drivers_commission_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.users ("uid", "email", "displayName", "photoURL", "role")
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'displayName', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    case
      when new.raw_user_meta_data->>'role' in ('rider', 'driver')
        then new.raw_user_meta_data->>'role'
      else 'rider'
    end
  )
  on conflict ("uid") do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_promo_use"("promo_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  UPDATE promotions SET "usedCount" = "usedCount" + 1 WHERE id = promo_id;
$$;


ALTER FUNCTION "public"."increment_promo_use"("promo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."payment_intents_lock_terminal"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if OLD."status" in ('successful', 'failed') and NEW."status" is distinct from OLD."status" then
    raise exception 'payment_intents %: status is terminal (%) and cannot change', OLD."id", OLD."status";
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."payment_intents_lock_terminal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_driver_verification_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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


ALTER FUNCTION "public"."protect_driver_verification_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_user_role"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return NEW;
  end if;

  if TG_OP = 'UPDATE' and NEW.role is not distinct from OLD.role then
    return NEW;
  end if;

  if NEW.role is not null and NEW.role not in ('rider', 'driver') then
    raise exception 'role % cannot be set from the app', NEW.role
      using errcode = '42501';
  end if;

  -- The only role change the app makes is Google driver signup moving a new
  -- account from 'rider' to 'driver' (lib/driver-auth-service.ts). Anything
  -- else (driver -> rider, clearing the role) must go through the backend.
  if TG_OP = 'UPDATE' and not (OLD.role = 'rider' and NEW.role = 'driver') then
    raise exception 'role cannot be changed from % to % from the app', OLD.role, NEW.role
      using errcode = '42501';
  end if;

  return NEW;
end;
$$;


ALTER FUNCTION "public"."protect_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refund_intents_check_amount"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_lock_key text;
  v_already_refunded numeric;
begin
  v_lock_key := coalesce(NEW."paymentIntentId"::text, NEW."rideId"::text);
  perform pg_advisory_xact_lock(hashtext(v_lock_key));

  select coalesce(sum(r."amount"), 0) into v_already_refunded
  from public.refund_intents r
  where (
      (NEW."paymentIntentId" is not null and r."paymentIntentId" = NEW."paymentIntentId") or
      (NEW."rideId" is not null and r."rideId" = NEW."rideId")
    )
    and r."status" in ('requested', 'processing', 'unknown', 'completed')
    and r."id" is distinct from NEW."id";

  if v_already_refunded + NEW."amount" > NEW."originalAmount" then
    raise exception 'refund amount % would exceed the refundable balance (already refunded/in-flight: %, original: %)',
      NEW."amount", v_already_refunded, NEW."originalAmount";
  end if;

  return NEW;
end;
$$;


ALTER FUNCTION "public"."refund_intents_check_amount"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refund_intents_validate_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if NEW."status" is distinct from OLD."status" then
    if not (
      (OLD."status" = 'requested'  and NEW."status" in ('processing', 'cancelled', 'failed')) or
      (OLD."status" = 'processing' and NEW."status" in ('completed', 'failed', 'unknown')) or
      (OLD."status" = 'unknown'    and NEW."status" in ('completed', 'failed')) or
      -- A completed refund may only ever be reversed — never resurrected
      -- into any other state, and never silently rewritten back to failed.
      (OLD."status" = 'completed'  and NEW."status" = 'reversed')
    ) then
      raise exception 'refund_intents %: invalid status transition % -> %', OLD."id", OLD."status", NEW."status";
    end if;
  end if;
  NEW."updatedAt" := now();
  return NEW;
end;
$$;


ALTER FUNCTION "public"."refund_intents_validate_transition"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ride_payment_is_cash"("p_payment_method" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select lower(coalesce(p_payment_method, '')) = 'cash'
    or exists (
      select 1 from public.payment_methods pm
      where pm."id"::text = p_payment_method
        and pm."type" in ('cash', 'card')
    );
$$;


ALTER FUNCTION "public"."ride_payment_is_cash"("p_payment_method" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rides_cash_commission_debit_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if NEW."status" = 'completed'
     and OLD."status" is distinct from 'completed'
     and public.ride_payment_is_cash(NEW."paymentMethod")
     and NEW."driverId" is not null
     and coalesce(NEW."platformCommissionAmount", 0) > 0
  then
    insert into public.driver_commission_ledger ("driverId", "rideId", "type", "amount", "reason")
    values (
      NEW."driverId",
      NEW."id",
      'cash_commission_debit',
      -NEW."platformCommissionAmount",
      'Commission owed on cash ride ' || NEW."id"
    )
    -- Idempotent no-op on a retried/duplicate trigger invocation for the
    -- same ride (idx_driver_commission_ledger_ride_debit above).
    on conflict ("rideId") where "type" = 'cash_commission_debit' do nothing;
  end if;

  return NEW;
end;
$$;


ALTER FUNCTION "public"."rides_cash_commission_debit_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rides_cash_dispatch_guard_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if NEW."status" = 'accepted'
     and OLD."status" is distinct from 'accepted'
     and NEW."driverId" is not null
     and public.ride_payment_is_cash(NEW."paymentMethod")
     and public.get_driver_net_balance(NEW."driverId"::text) < -public.get_driver_cash_debt_limit()
  then
    -- The app matches on this CASH_RIDES_PAUSED prefix to show the driver a
    -- readable message instead of a raw database error.
    raise exception 'CASH_RIDES_PAUSED: this driver owes more than the cash commission limit and must settle it before accepting cash rides';
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."rides_cash_dispatch_guard_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rides_protect_financial_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_wait_grace numeric;
  v_wait_rate numeric;
  v_free_window numeric;
  v_after_accept numeric;
  v_after_arrival numeric;
  v_is_waiting_transition boolean;
  v_is_cancel_transition boolean;
  v_is_settling boolean;
begin
  if auth.role() = 'service_role' then
    return NEW;
  end if;

  v_is_waiting_transition := (OLD."status" = 'accepted' and NEW."status" = 'in-progress');
  v_is_cancel_transition := (OLD."status" not in ('completed', 'cancelled') and NEW."status" = 'cancelled');
  v_is_settling := (NEW."status" in ('completed', 'cancelled'));

  if NEW."baseFare" is distinct from OLD."baseFare"
     or NEW."minFare" is distinct from OLD."minFare"
     or NEW."maxFare" is distinct from OLD."maxFare"
     or NEW."bookingFee" is distinct from OLD."bookingFee"
     or NEW."serviceFee" is distinct from OLD."serviceFee"
     or NEW."zoneFee" is distinct from OLD."zoneFee"
     or NEW."priorityFee" is distinct from OLD."priorityFee"
     or NEW."distance" is distinct from OLD."distance"
     or NEW."duration" is distinct from OLD."duration"
     or NEW."fareAdjustmentPercent" is distinct from OLD."fareAdjustmentPercent"
     or NEW."paymentStatus" is distinct from OLD."paymentStatus"
     or NEW."fareSource" is distinct from OLD."fareSource"
  then
    raise exception 'rides.%: this field can only be set by the server', NEW."id";
  end if;

  if not v_is_settling then
    if NEW."platformCommissionRate" is distinct from OLD."platformCommissionRate"
       or NEW."platformCommissionAmount" is distinct from OLD."platformCommissionAmount"
       or NEW."driverEarningsAmount" is distinct from OLD."driverEarningsAmount"
    then
      raise exception 'rides.%: commission/earnings can only change when a ride settles', NEW."id";
    end if;
  end if;

  if v_is_waiting_transition then
    select "graceMinutes", "perMinuteRate" into v_wait_grace, v_wait_rate
      from public.waiting_charge_config limit 1;
    NEW."waitingCharge" := case
      when OLD."arrivedAt" is not null then
        greatest(0, round((extract(epoch from (now() - OLD."arrivedAt")) / 60
          - coalesce(v_wait_grace, 3)) * coalesce(v_wait_rate, 40), 2))
      else 0
    end;
  elsif NEW."waitingCharge" is distinct from OLD."waitingCharge" then
    raise exception 'rides.%: waitingCharge can only be set by the server on trip start', NEW."id";
  end if;

  if v_is_cancel_transition then
    select "freeWindowSeconds", "afterAcceptFee", "afterArrivalFee"
      into v_free_window, v_after_accept, v_after_arrival
      from public.cancellation_fee_config limit 1;
    NEW."cancellationFee" := case
      when OLD."acceptedAt" is null or OLD."status" = 'pending' then 0
      when extract(epoch from (now() - OLD."acceptedAt")) <= coalesce(v_free_window, 60) then 0
      when OLD."arrivedAt" is not null then coalesce(v_after_arrival, 500)
      else coalesce(v_after_accept, 200)
    end;
  elsif NEW."cancellationFee" is distinct from OLD."cancellationFee" then
    raise exception 'rides.%: cancellationFee can only be set by the server on cancellation', NEW."id";
  end if;

  if v_is_waiting_transition then
    NEW."fare" := coalesce(OLD."fare", 0) + NEW."waitingCharge";
  elsif v_is_cancel_transition then
    NEW."fare" := NEW."cancellationFee";
  elsif NEW."fare" is distinct from OLD."fare" then
    raise exception 'rides.%: fare can only be set by the server', NEW."id";
  end if;

  return NEW;
end;
$$;


ALTER FUNCTION "public"."rides_protect_financial_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rides_settle_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_rate numeric;
  v_metered_fare numeric;
  v_commission numeric;
  v_is_cash boolean;
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
    v_commission := v_metered_fare * v_rate;
    v_is_cash := public.ride_payment_is_cash(NEW."paymentMethod");

    NEW."platformCommissionRate" := v_rate;
    NEW."platformCommissionAmount" := v_commission;

    if v_is_cash then
      -- The driver already collected 100% of the fare in person — Pantra
      -- owes nothing through the payout system for this ride.
      NEW."driverEarningsAmount" := 0;
    else
      NEW."driverEarningsAmount" := coalesce(NEW."fare", 0) - v_commission;
    end if;
  end if;

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


ALTER FUNCTION "public"."rides_settle_trigger"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rideId" "text" NOT NULL,
    "userId" "uuid",
    "driverId" "uuid",
    "rating" numeric NOT NULL,
    "comment" "text",
    "tags" "text"[],
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ratings_rating_check" CHECK ((("rating" >= (1)::numeric) AND ("rating" <= (5)::numeric)))
);


ALTER TABLE "public"."ratings" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_rating"("p_ride_id" "text", "p_driver_id" "uuid", "p_rating" numeric, "p_comment" "text" DEFAULT NULL::"text", "p_tags" "text"[] DEFAULT NULL::"text"[]) RETURNS "public"."ratings"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
declare
  v_rating public.ratings;
  v_avg numeric;
  v_count integer;
  v_distribution jsonb;
begin
  if p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be between 1 and 5';
  end if;

  if exists (select 1 from public.ratings where "rideId" = p_ride_id and "userId" = auth.uid()) then
    raise exception 'Rating already submitted for this ride';
  end if;

  insert into public.ratings ("rideId", "userId", "driverId", "rating", "comment", "tags")
  values (p_ride_id, auth.uid(), p_driver_id, p_rating, p_comment, p_tags)
  returning * into v_rating;

  select avg("rating"), count(*) into v_avg, v_count
  from public.ratings where "driverId" = p_driver_id;

  select jsonb_build_object(
    '1', count(*) filter (where "rating" = 1),
    '2', count(*) filter (where "rating" = 2),
    '3', count(*) filter (where "rating" = 3),
    '4', count(*) filter (where "rating" = 4),
    '5', count(*) filter (where "rating" = 5)
  ) into v_distribution
  from public.ratings where "driverId" = p_driver_id;

  update public.drivers
  set "rating" = round(v_avg, 1), "totalRatings" = v_count, "ratingDistribution" = v_distribution
  where "id" = p_driver_id;

  if p_ride_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    update public.rides set "driverRating" = p_rating where "id" = p_ride_id::uuid;
  end if;

  return v_rating;
end;
$_$;


ALTER FUNCTION "public"."submit_rating"("p_ride_id" "text", "p_driver_id" "uuid", "p_rating" numeric, "p_comment" "text", "p_tags" "text"[]) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_ratings_of_riders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rideId" "text" NOT NULL,
    "driverId" "uuid",
    "userId" "uuid",
    "rating" numeric NOT NULL,
    "comment" "text",
    "tags" "text"[],
    "createdAt" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "driver_ratings_of_riders_rating_check" CHECK ((("rating" >= (1)::numeric) AND ("rating" <= (5)::numeric)))
);


ALTER TABLE "public"."driver_ratings_of_riders" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_rider_rating"("p_ride_id" "text", "p_user_id" "uuid", "p_rating" numeric, "p_comment" "text" DEFAULT NULL::"text", "p_tags" "text"[] DEFAULT NULL::"text"[]) RETURNS "public"."driver_ratings_of_riders"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_driver_id uuid;
  v_rating public.driver_ratings_of_riders;
  v_avg numeric;
  v_count integer;
begin
  if p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be between 1 and 5';
  end if;

  select "id" into v_driver_id from public.drivers where "userId" = auth.uid();
  if v_driver_id is null then
    raise exception 'Only drivers can rate riders';
  end if;

  if exists (select 1 from public.driver_ratings_of_riders where "rideId" = p_ride_id and "driverId" = v_driver_id) then
    raise exception 'Rating already submitted for this ride';
  end if;

  insert into public.driver_ratings_of_riders ("rideId", "driverId", "userId", "rating", "comment", "tags")
  values (p_ride_id, v_driver_id, p_user_id, p_rating, p_comment, p_tags)
  returning * into v_rating;

  select avg("rating"), count(*) into v_avg, v_count
  from public.driver_ratings_of_riders where "userId" = p_user_id;

  update public.users
  set "rating" = round(v_avg, 1), "totalRatings" = v_count
  where "uid" = p_user_id;

  return v_rating;
end;
$$;


ALTER FUNCTION "public"."submit_rider_rating"("p_ride_id" "text", "p_user_id" "uuid", "p_rating" numeric, "p_comment" "text", "p_tags" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_roles"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if NEW.role in ('rider', 'driver') then
    insert into public.user_roles ("userId", role)
    values (NEW.uid, NEW.role)
    on conflict do nothing;
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."sync_user_roles"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_pending_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actionType" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "rationale" "text" NOT NULL,
    "beforeSnapshot" "jsonb",
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "result" "jsonb",
    "error" "text",
    "resolvedByAdminId" "uuid",
    "resolutionNote" "text",
    "resolvedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agent_pending_actions_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'APPROVED'::"text", 'REJECTED'::"text", 'EXECUTED'::"text", 'EXECUTION_FAILED'::"text"])))
);


ALTER TABLE "public"."agent_pending_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_video_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "screenKey" "text" NOT NULL,
    "videoUrl" "text" NOT NULL,
    "isEnabled" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "app_video_config_screenKey_check" CHECK (("screenKey" = ANY (ARRAY['splash'::"text", 'role_selection'::"text", 'rider_login'::"text", 'rider_signup'::"text", 'forgot_password'::"text", 'driver_login'::"text", 'driver_signup'::"text", 'driver_dashboard'::"text"])))
);


ALTER TABLE "public"."app_video_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cancellation_fee_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "freeWindowSeconds" numeric DEFAULT 60 NOT NULL,
    "afterAcceptFee" numeric DEFAULT 200 NOT NULL,
    "afterArrivalFee" numeric DEFAULT 500 NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cancellation_fee_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "text" NOT NULL,
    "userId" "uuid",
    "userName" "text",
    "userPhone" "text",
    "driverId" "uuid",
    "driverName" "text",
    "driverPhone" "text",
    "rideId" "uuid",
    "lastMessage" "text",
    "lastMessageTime" timestamp with time zone,
    "unreadCountUser" integer DEFAULT 0,
    "unreadCountDriver" integer DEFAULT 0,
    "status" "text" DEFAULT 'active'::"text",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "conversations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_bank_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driverId" "text" NOT NULL,
    "bankName" "text" NOT NULL,
    "accountNumber" "text",
    "accountName" "text" NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accountNumberEncrypted" "text",
    "accountNumberLast4" "text",
    "bankCode" "text",
    "paystackRecipientCode" "text",
    "recipientVerifiedAt" timestamp with time zone,
    "recipientInvalidatedAt" timestamp with time zone
);


ALTER TABLE "public"."driver_bank_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_commission_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driverId" "uuid" NOT NULL,
    "rideId" "uuid",
    "type" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "reason" "text",
    "createdBy" "uuid",
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reference" "text",
    CONSTRAINT "driver_commission_ledger_sign_check" CHECK (((("type" <> 'cash_commission_debit'::"text") OR ("amount" < (0)::numeric)) AND (("type" <> 'cash_commission_settlement'::"text") OR (("amount" > (0)::numeric) AND ("reference" IS NOT NULL))))),
    CONSTRAINT "driver_commission_ledger_type_check" CHECK (("type" = ANY (ARRAY['cash_commission_debit'::"text", 'cash_commission_settlement'::"text", 'adjustment'::"text"])))
);


ALTER TABLE "public"."driver_commission_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_document_verification_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "documentId" "uuid",
    "driverId" "uuid",
    "checkType" "text",
    "status" "text",
    "provider" "text",
    "providerReferenceId" "text",
    "resultDetails" "jsonb",
    "checkedAt" timestamp with time zone DEFAULT "now"(),
    "createdAt" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "driver_document_verification_checks_checkType_check" CHECK (("checkType" = ANY (ARRAY['format'::"text", 'ocr_consistency'::"text", 'authenticity'::"text"]))),
    CONSTRAINT "driver_document_verification_checks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'pass'::"text", 'fail'::"text", 'mismatch'::"text", 'manual_review'::"text", 'not_configured'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."driver_document_verification_checks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driverId" "uuid",
    "type" "text",
    "documentUrl" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "uploadedAt" timestamp with time zone DEFAULT "now"(),
    "reviewedAt" timestamp with time zone,
    "reviewedBy" "uuid",
    "rejectionReason" "text",
    "expiryDate" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "driver_documents_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "driver_documents_type_check" CHECK (("type" = ANY (ARRAY['license'::"text", 'insurance'::"text", 'registration'::"text", 'background_check'::"text", 'vehicle_inspection'::"text", 'drivers_license_front'::"text", 'drivers_license_back'::"text", 'driver_selfie'::"text", 'vehicle_registration'::"text", 'proof_of_ownership'::"text", 'roadworthiness'::"text", 'national_id'::"text", 'vehicle_exterior'::"text", 'vehicle_interior_front'::"text", 'vehicle_interior_rear'::"text"])))
);


ALTER TABLE "public"."driver_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_online_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driverId" "uuid",
    "startedAt" timestamp with time zone DEFAULT "now"(),
    "endedAt" timestamp with time zone
);


ALTER TABLE "public"."driver_online_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driverId" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "bankAccountId" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "failureReason" "text",
    "requestedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completedAt" timestamp with time zone,
    "payoutMethod" "text" DEFAULT 'automatic'::"text" NOT NULL,
    "provider" "text",
    "providerTransferReference" "text",
    "providerTransferCode" "text",
    "processingStartedAt" timestamp with time zone,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "driver_payouts_payoutmethod_check" CHECK (("payoutMethod" = ANY (ARRAY['automatic'::"text", 'manual'::"text"]))),
    CONSTRAINT "driver_payouts_provider_check" CHECK ((("provider" IS NULL) OR ("provider" = ANY (ARRAY['paystack'::"text", 'flutterwave'::"text"])))),
    CONSTRAINT "driver_payouts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'manual_review'::"text", 'completed'::"text", 'failed'::"text", 'reversed'::"text"])))
);


ALTER TABLE "public"."driver_payouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_verification_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driverId" "uuid",
    "actorType" "text",
    "actorId" "uuid",
    "eventType" "text",
    "fromStatus" "text",
    "toStatus" "text",
    "documentId" "uuid",
    "reason" "text",
    "metadata" "jsonb",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "driver_verification_audit_log_actorType_check" CHECK (("actorType" = ANY (ARRAY['system'::"text", 'admin'::"text", 'driver'::"text"]))),
    CONSTRAINT "driver_verification_audit_log_eventType_check" CHECK (("eventType" = ANY (ARRAY['STATUS_CHANGED'::"text", 'DOCUMENT_SUBMITTED'::"text", 'FORMAT_CHECK_RUN'::"text", 'OCR_CHECK_RUN'::"text", 'AUTHENTICITY_CHECK_RUN'::"text", 'ADMIN_DECISION'::"text", 'PHONE_VERIFIED'::"text", 'EMAIL_VERIFIED'::"text"])))
);


ALTER TABLE "public"."driver_verification_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_verification_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "state" "text" NOT NULL,
    "vehicleCategory" "text" NOT NULL,
    "documentType" "text" NOT NULL,
    "isRequired" boolean DEFAULT true NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "updatedAt" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."driver_verification_requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."drivers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "userId" "uuid",
    "name" "text",
    "email" "text",
    "phone" "text",
    "rating" numeric,
    "totalRides" integer DEFAULT 0,
    "isOnline" boolean DEFAULT false,
    "isVerified" boolean DEFAULT false,
    "profileImage" "text",
    "location" "jsonb",
    "vehicle" "jsonb",
    "documents" "jsonb",
    "earnings" "jsonb" DEFAULT '{"today": 0, "total": 0, "thisWeek": 0, "thisMonth": 0}'::"jsonb",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "lastActiveAt" timestamp with time zone DEFAULT "now"(),
    "totalRatings" integer DEFAULT 0,
    "ratingDistribution" "jsonb" DEFAULT '{"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}'::"jsonb",
    "verificationProgress" numeric DEFAULT 0,
    "pushToken" "text",
    "fullLegalName" "text",
    "dateOfBirth" "date",
    "operatingState" "text",
    "vehicleCategory" "text",
    "phoneVerifiedAt" timestamp with time zone,
    "emailVerifiedAt" timestamp with time zone,
    "licenseNumber" "text",
    "licenseCategory" "text",
    "licenseIssueDate" "date",
    "licenseExpiryDate" "date",
    "vehiclePlateNumber" "text",
    "vehicleVin" "text",
    "vehicleEngineNumber" "text",
    "verificationStatus" "text" DEFAULT 'PENDING'::"text",
    "verificationStatusUpdatedAt" timestamp with time zone DEFAULT "now"(),
    "rejectionReason" "text",
    CONSTRAINT "drivers_verificationStatus_check" CHECK (("verificationStatus" = ANY (ARRAY['PENDING'::"text", 'DOCUMENTS_SUBMITTED'::"text", 'VERIFYING'::"text", 'VERIFIED'::"text", 'REJECTED'::"text", 'MANUAL_REVIEW'::"text"])))
);


ALTER TABLE "public"."drivers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "userId" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "relationship" "text" NOT NULL,
    "phone" "text",
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."family_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversationId" "text",
    "senderId" "uuid",
    "senderType" "text",
    "text" "text",
    "read" boolean DEFAULT false,
    "createdAt" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "messages_senderType_check" CHECK (("senderType" = ANY (ARRAY['user'::"text", 'driver'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."password_reset_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "userId" "uuid" NOT NULL,
    "method" "text" DEFAULT 'email'::"text" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "password_reset_events_method_check" CHECK (("method" = 'email'::"text"))
);


ALTER TABLE "public"."password_reset_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "paymentIntentId" "uuid",
    "provider" "text" NOT NULL,
    "reference" "text" NOT NULL,
    "providerEventId" "text",
    "eventType" "text" NOT NULL,
    "sourceChannel" "text" NOT NULL,
    "providerState" "text",
    "amount" numeric(12,2),
    "currency" "text",
    "processingStatus" "text" DEFAULT 'received'::"text" NOT NULL,
    "failureReason" "text",
    "safeMetadata" "jsonb",
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processedAt" timestamp with time zone,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_events_processingStatus_check" CHECK (("processingStatus" = ANY (ARRAY['received'::"text", 'processed'::"text", 'ignored_duplicate'::"text", 'rejected_invalid_signature'::"text", 'rejected_amount_mismatch'::"text", 'rejected_currency_mismatch'::"text", 'rejected_unmatched_intent'::"text", 'provider_pending'::"text", 'provider_failed'::"text", 'provider_unknown'::"text"]))),
    CONSTRAINT "payment_events_provider_check" CHECK (("provider" = ANY (ARRAY['paystack'::"text", 'flutterwave'::"text"]))),
    CONSTRAINT "payment_events_sourceChannel_check" CHECK (("sourceChannel" = ANY (ARRAY['webhook'::"text", 'client_verification'::"text", 'admin_reconciliation'::"text"])))
);


ALTER TABLE "public"."payment_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "userId" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "reference" "text" NOT NULL,
    "providerTransactionId" "text",
    "purpose" "text" DEFAULT 'wallet_funding'::"text" NOT NULL,
    "expectedAmount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'NGN'::"text" NOT NULL,
    "paymentMethodId" "text",
    "status" "text" DEFAULT 'initialized'::"text" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_intents_expectedAmount_check" CHECK (("expectedAmount" > (0)::numeric)),
    CONSTRAINT "payment_intents_provider_check" CHECK (("provider" = ANY (ARRAY['paystack'::"text", 'flutterwave'::"text"]))),
    CONSTRAINT "payment_intents_status_check" CHECK (("status" = ANY (ARRAY['initialized'::"text", 'pending'::"text", 'successful'::"text", 'failed'::"text", 'cancelled'::"text", 'expired'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."payment_intents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "userId" "uuid",
    "type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "lastFour" "text",
    "expiryDate" "text",
    "isDefault" boolean DEFAULT false,
    "icon" "text",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payment_methods_type_check" CHECK (("type" = ANY (ARRAY['cash'::"text", 'wallet'::"text"])))
);


ALTER TABLE "public"."payment_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_reconciliation_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "paymentIntentId" "uuid",
    "provider" "text" NOT NULL,
    "reference" "text" NOT NULL,
    "expectedAmount" numeric(12,2),
    "providerAmount" numeric(12,2),
    "currency" "text",
    "pantraStatus" "text",
    "providerStatus" "text",
    "mismatchType" "text" NOT NULL,
    "reconciliationStatus" "text" DEFAULT 'open'::"text" NOT NULL,
    "detectedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolvedAt" timestamp with time zone,
    "notes" "text",
    "payoutId" "uuid",
    "refundId" "uuid",
    CONSTRAINT "payment_reconciliation_records_mismatchtype_check" CHECK (("mismatchType" = ANY (ARRAY['amount_mismatch'::"text", 'currency_mismatch'::"text", 'unmatched_provider_transaction'::"text", 'pantra_success_provider_failed'::"text", 'payout_amount_mismatch'::"text", 'payout_currency_mismatch'::"text", 'payout_unmatched_provider_transaction'::"text", 'payout_provider_reversed'::"text", 'payout_unresolved_after_timeout'::"text", 'refund_amount_mismatch'::"text", 'refund_currency_mismatch'::"text", 'refund_unmatched_provider_transaction'::"text", 'refund_reversed'::"text"]))),
    CONSTRAINT "payment_reconciliation_records_reconciliationStatus_check" CHECK (("reconciliationStatus" = ANY (ARRAY['open'::"text", 'resolved'::"text", 'ignored'::"text"])))
);


ALTER TABLE "public"."payment_reconciliation_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payout_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payoutId" "uuid",
    "provider" "text" NOT NULL,
    "providerTransferReference" "text",
    "providerEventId" "text",
    "eventType" "text" NOT NULL,
    "providerState" "text",
    "amount" numeric(12,2),
    "currency" "text",
    "processingStatus" "text" DEFAULT 'received'::"text" NOT NULL,
    "failureReason" "text",
    "safeMetadata" "jsonb",
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processedAt" timestamp with time zone,
    CONSTRAINT "payout_events_processingStatus_check" CHECK (("processingStatus" = ANY (ARRAY['received'::"text", 'processed'::"text", 'ignored_duplicate'::"text", 'rejected_unmatched_payout'::"text", 'rejected_amount_mismatch'::"text", 'rejected_currency_mismatch'::"text", 'flagged_for_manual_review'::"text"]))),
    CONSTRAINT "payout_events_provider_check" CHECK (("provider" = ANY (ARRAY['paystack'::"text", 'flutterwave'::"text"])))
);


ALTER TABLE "public"."payout_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payout_manual_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payoutId" "uuid" NOT NULL,
    "adminUserId" "uuid",
    "action" "text" NOT NULL,
    "externalReference" "text",
    "notes" "text",
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payout_manual_actions_action_check" CHECK (("action" = ANY (ARRAY['moved_to_manual_review'::"text", 'manual_completed'::"text", 'manual_failed'::"text", 'retry_initiated'::"text"])))
);


ALTER TABLE "public"."payout_manual_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payout_provider_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payoutId" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "providerTransferReference" "text" NOT NULL,
    "providerTransferCode" "text",
    "attemptStatus" "text" DEFAULT 'call_initiated'::"text" NOT NULL,
    "httpStatus" integer,
    "failureReason" "text",
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payout_provider_attempts_attemptStatus_check" CHECK (("attemptStatus" = ANY (ARRAY['call_initiated'::"text", 'call_succeeded'::"text", 'call_failed_network'::"text", 'call_failed_duplicate_reference'::"text", 'call_timeout'::"text", 'call_rejected'::"text"]))),
    CONSTRAINT "payout_provider_attempts_provider_check" CHECK (("provider" = ANY (ARRAY['paystack'::"text", 'flutterwave'::"text"])))
);


ALTER TABLE "public"."payout_provider_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_commission_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rate" numeric DEFAULT 0.1 NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "cashDebtLimit" numeric(12,2) DEFAULT 5000 NOT NULL
);


ALTER TABLE "public"."platform_commission_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."points_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "userId" "text" NOT NULL,
    "amount" integer NOT NULL,
    "type" "text" NOT NULL,
    "referenceId" "text",
    "description" "text" NOT NULL,
    "expiresAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "points_transactions_type_check" CHECK (("type" = ANY (ARRAY['task_reward'::"text", 'ride_redemption'::"text", 'expiry'::"text"])))
);


ALTER TABLE "public"."points_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_priority_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fee" numeric DEFAULT 500 NOT NULL,
    "isEnabled" boolean DEFAULT true NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pricing_priority_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_tier_config" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "base" numeric NOT NULL,
    "perKm" numeric NOT NULL,
    "perMin" numeric NOT NULL,
    "minFare" numeric NOT NULL,
    "bookingFee" numeric DEFAULT 100 NOT NULL,
    "serviceFee" numeric DEFAULT 0 NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pricing_tier_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promotions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "description" "text" NOT NULL,
    "discountPercentage" numeric(5,2) NOT NULL,
    "maxDiscountNGN" numeric(10,2),
    "maxUses" integer,
    "usedCount" integer DEFAULT 0 NOT NULL,
    "validFrom" timestamp with time zone DEFAULT "now"() NOT NULL,
    "validUntil" timestamp with time zone NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."promotions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refund_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "refundId" "uuid",
    "provider" "text" NOT NULL,
    "refundReference" "text",
    "providerEventId" "text",
    "eventType" "text" NOT NULL,
    "providerState" "text",
    "amount" numeric(12,2),
    "currency" "text",
    "processingStatus" "text" DEFAULT 'received'::"text" NOT NULL,
    "failureReason" "text",
    "safeMetadata" "jsonb",
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processedAt" timestamp with time zone,
    CONSTRAINT "refund_events_processingStatus_check" CHECK (("processingStatus" = ANY (ARRAY['received'::"text", 'processed'::"text", 'ignored_duplicate'::"text", 'rejected_unmatched_refund'::"text", 'rejected_amount_mismatch'::"text", 'rejected_currency_mismatch'::"text"]))),
    CONSTRAINT "refund_events_provider_check" CHECK (("provider" = ANY (ARRAY['paystack'::"text", 'flutterwave'::"text"])))
);


ALTER TABLE "public"."refund_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refund_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "originalPaymentType" "text" NOT NULL,
    "paymentIntentId" "uuid",
    "rideId" "uuid",
    "originalWalletTransactionId" "uuid",
    "userId" "uuid" NOT NULL,
    "provider" "text",
    "refundReference" "text" NOT NULL,
    "providerRefundId" "text",
    "originalAmount" numeric(12,2) NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'NGN'::"text" NOT NULL,
    "reason" "text",
    "refundType" "text" NOT NULL,
    "requestedBy" "uuid" NOT NULL,
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "idempotencyKey" "text" NOT NULL,
    "walletTransactionId" "uuid",
    "driverImpactAmount" numeric(12,2),
    "requiresDriverAdjustmentReview" boolean DEFAULT false NOT NULL,
    "failureReason" "text",
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "providerRefundReference" "text",
    CONSTRAINT "refund_intents_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "refund_intents_amount_within_original" CHECK (("amount" <= "originalAmount")),
    CONSTRAINT "refund_intents_originalAmount_check" CHECK (("originalAmount" > (0)::numeric)),
    CONSTRAINT "refund_intents_originalPaymentType_check" CHECK (("originalPaymentType" = ANY (ARRAY['wallet_topup'::"text", 'ride_wallet_payment'::"text"]))),
    CONSTRAINT "refund_intents_provider_check" CHECK ((("provider" IS NULL) OR ("provider" = ANY (ARRAY['paystack'::"text", 'flutterwave'::"text"])))),
    CONSTRAINT "refund_intents_refundType_check" CHECK (("refundType" = ANY (ARRAY['full'::"text", 'partial'::"text"]))),
    CONSTRAINT "refund_intents_source_check" CHECK (((("originalPaymentType" = 'wallet_topup'::"text") AND ("paymentIntentId" IS NOT NULL) AND ("rideId" IS NULL)) OR (("originalPaymentType" = 'ride_wallet_payment'::"text") AND ("rideId" IS NOT NULL) AND ("paymentIntentId" IS NULL)))),
    CONSTRAINT "refund_intents_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text", 'reversed'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."refund_intents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refund_provider_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "refundId" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "refundReference" "text" NOT NULL,
    "attemptStatus" "text" DEFAULT 'call_initiated'::"text" NOT NULL,
    "httpStatus" integer,
    "failureReason" "text",
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "refund_provider_attempts_attemptStatus_check" CHECK (("attemptStatus" = ANY (ARRAY['call_initiated'::"text", 'call_succeeded'::"text", 'call_failed_network'::"text", 'call_failed_duplicate_reference'::"text", 'call_timeout'::"text", 'call_rejected'::"text"]))),
    CONSTRAINT "refund_provider_attempts_provider_check" CHECK (("provider" = ANY (ARRAY['paystack'::"text", 'flutterwave'::"text"])))
);


ALTER TABLE "public"."refund_provider_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reward_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "url" "text",
    "pointsReward" integer NOT NULL,
    "minWatchSeconds" integer,
    "maxCompletionsPerUser" integer DEFAULT 1 NOT NULL,
    "totalMaxCompletions" integer,
    "completedCount" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "validUntil" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reward_tasks_type_check" CHECK (("type" = ANY (ARRAY['youtube_video'::"text", 'social_share'::"text"])))
);


ALTER TABLE "public"."reward_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_declines" (
    "rideId" "uuid" NOT NULL,
    "driverId" "uuid" NOT NULL,
    "declinedAt" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ride_declines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rider_preferences" (
    "userId" "uuid" NOT NULL,
    "locationSharing" boolean DEFAULT false NOT NULL,
    "dataCollection" boolean DEFAULT false NOT NULL,
    "personalizedAds" boolean DEFAULT false NOT NULL,
    "profileVisibility" boolean DEFAULT false NOT NULL,
    "twoFactorRequested" boolean DEFAULT false NOT NULL,
    "biometricLogin" boolean DEFAULT false NOT NULL,
    "loginAlerts" boolean DEFAULT false NOT NULL,
    "shareTrip" boolean DEFAULT false NOT NULL,
    "emergencyContactsEnabled" boolean DEFAULT false NOT NULL,
    "rideCheck" boolean DEFAULT false NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rider_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "userId" "uuid",
    "driverId" "uuid",
    "pickupLocation" "jsonb",
    "dropoffLocation" "jsonb",
    "pickupAddress" "text",
    "dropoffAddress" "text",
    "rideType" "text" DEFAULT 'standard'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "fare" numeric(12,2) DEFAULT 0,
    "baseFare" numeric(12,2) DEFAULT 0,
    "minFare" numeric(12,2) DEFAULT 0,
    "maxFare" numeric(12,2) DEFAULT 0,
    "fareAdjustmentPercent" numeric DEFAULT 0,
    "distance" numeric DEFAULT 0,
    "duration" integer DEFAULT 0,
    "trackingStage" "text",
    "statusText" "text",
    "driverLocation" "jsonb",
    "paymentMethod" "text",
    "promoCode" "text",
    "isShared" boolean DEFAULT false,
    "sharedWith" "text"[],
    "scheduledTime" timestamp with time zone,
    "cancelReason" "text",
    "cancelReasonDetails" "text",
    "acceptedAt" timestamp with time zone,
    "startedAt" timestamp with time zone,
    "completedAt" timestamp with time zone,
    "cancelledAt" timestamp with time zone,
    "driverRating" numeric,
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "scheduled_for" timestamp with time zone,
    "bookingFee" numeric(12,2) DEFAULT 0,
    "serviceFee" numeric(12,2) DEFAULT 0,
    "cancellationFee" numeric(12,2) DEFAULT 0,
    "offeredFare" numeric(12,2),
    "negotiationStatus" "text",
    "offerExpiresAt" timestamp with time zone,
    "arrivedAt" timestamp with time zone,
    "waitingCharge" numeric(12,2) DEFAULT 0,
    "zoneFee" numeric(12,2) DEFAULT 0,
    "isPriority" boolean DEFAULT false,
    "priorityFee" numeric(12,2) DEFAULT 0,
    "paymentStatus" "text" DEFAULT 'unpaid'::"text",
    "platformCommissionRate" numeric(6,4),
    "platformCommissionAmount" numeric(12,2),
    "driverEarningsAmount" numeric(12,2),
    "fareSource" "text",
    "passengerName" "text",
    "passengerPhone" "text",
    CONSTRAINT "rides_negotiationStatus_check" CHECK (("negotiationStatus" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'expired'::"text"]))),
    CONSTRAINT "rides_paymentStatus_check" CHECK (("paymentStatus" = ANY (ARRAY['unpaid'::"text", 'pending'::"text", 'paid'::"text", 'failed'::"text"]))),
    CONSTRAINT "rides_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'in-progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."rides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "userId" "uuid",
    "name" "text" NOT NULL,
    "address" "text" NOT NULL,
    "latitude" numeric NOT NULL,
    "longitude" numeric NOT NULL,
    "type" "text" NOT NULL,
    "icon" "text",
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "saved_locations_type_check" CHECK (("type" = ANY (ARRAY['home'::"text", 'work'::"text", 'favorite'::"text"])))
);


ALTER TABLE "public"."saved_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_ticket_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticketId" "uuid" NOT NULL,
    "actorType" "text" NOT NULL,
    "actorId" "uuid",
    "eventType" "text" NOT NULL,
    "fromStatus" "text",
    "toStatus" "text",
    "reason" "text",
    "metadata" "jsonb",
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "support_ticket_events_actorType_check" CHECK (("actorType" = ANY (ARRAY['system'::"text", 'admin'::"text", 'user'::"text", 'driver'::"text"]))),
    CONSTRAINT "support_ticket_events_eventType_check" CHECK (("eventType" = ANY (ARRAY['CREATED'::"text", 'STATUS_CHANGED'::"text", 'PRIORITY_CHANGED'::"text", 'ASSIGNED'::"text", 'MESSAGE_SENT'::"text"])))
);


ALTER TABLE "public"."support_ticket_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_ticket_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticketId" "uuid" NOT NULL,
    "senderType" "text" NOT NULL,
    "senderId" "uuid",
    "text" "text" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "support_ticket_messages_senderType_check" CHECK (("senderType" = ANY (ARRAY['user'::"text", 'driver'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."support_ticket_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "filedByUserId" "uuid" NOT NULL,
    "filedByRole" "text" NOT NULL,
    "filedByName" "text",
    "driverId" "uuid",
    "rideId" "uuid",
    "subject" "text" NOT NULL,
    "category" "text" DEFAULT 'other'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "assignedAdminId" "uuid",
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "support_tickets_category_check" CHECK (("category" = ANY (ARRAY['ride_issue'::"text", 'payment_issue'::"text", 'account_issue'::"text", 'safety'::"text", 'other'::"text"]))),
    CONSTRAINT "support_tickets_filedByRole_check" CHECK (("filedByRole" = ANY (ARRAY['rider'::"text", 'driver'::"text"]))),
    CONSTRAINT "support_tickets_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "support_tickets_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."support_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."surge_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "minMultiplier" numeric DEFAULT 1.0,
    "maxMultiplier" numeric DEFAULT 2.5,
    "highDemandRatio" numeric DEFAULT 1.5,
    "lowDemandRatio" numeric DEFAULT 0.3,
    "isEnabled" boolean DEFAULT true,
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "lowAcceptanceThreshold" numeric DEFAULT 0.5,
    "lowAcceptanceBonus" numeric DEFAULT 0.3,
    "acceptanceLookbackMinutes" integer DEFAULT 60
);


ALTER TABLE "public"."surge_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."traffic_multiplier_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "label" "text" NOT NULL,
    "daysOfWeek" integer[],
    "startMinute" integer,
    "endMinute" integer,
    "startDate" timestamp with time zone,
    "endDate" timestamp with time zone,
    "multiplier" numeric DEFAULT 1.0 NOT NULL,
    "isEnabled" boolean DEFAULT true NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."traffic_multiplier_rules" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_points_balance" AS
 SELECT "userId",
    (COALESCE("sum"("amount"), (0)::bigint))::integer AS "balance"
   FROM "public"."points_transactions"
  WHERE (("expiresAt" IS NULL) OR ("expiresAt" > "now"()))
  GROUP BY "userId";


ALTER VIEW "public"."user_points_balance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_promo_uses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "userId" "text" NOT NULL,
    "promoId" "uuid" NOT NULL,
    "rideId" "text",
    "usedAt" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_promo_uses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "userId" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_roles_role_check" CHECK (("role" = ANY (ARRAY['rider'::"text", 'driver'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_task_completions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "userId" "text" NOT NULL,
    "taskId" "uuid" NOT NULL,
    "pointsEarned" integer NOT NULL,
    "completedAt" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_task_completions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "uid" "uuid" NOT NULL,
    "email" "text",
    "displayName" "text",
    "photoURL" "text",
    "phoneNumber" "text",
    "role" "text" DEFAULT 'rider'::"text",
    "rating" numeric,
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"(),
    "pushToken" "text",
    "totalRatings" integer DEFAULT 0,
    "dateOfBirth" "date",
    "address" "text",
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['rider'::"text", 'driver'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waiting_charge_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "graceMinutes" numeric DEFAULT 3 NOT NULL,
    "perMinuteRate" numeric DEFAULT 40 NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."waiting_charge_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_bank_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "userId" "uuid",
    "bankName" "text" NOT NULL,
    "accountNumber" "text" NOT NULL,
    "accountHolderName" "text" NOT NULL,
    "ifscCode" "text",
    "swiftCode" "text",
    "type" "text" DEFAULT 'savings'::"text",
    "isDefault" boolean DEFAULT false,
    "isVerified" boolean DEFAULT false,
    "createdAt" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "wallet_bank_accounts_type_check" CHECK (("type" = ANY (ARRAY['savings'::"text", 'checking'::"text"])))
);


ALTER TABLE "public"."wallet_bank_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallets" (
    "userId" "uuid" NOT NULL,
    "balance" numeric(12,2) DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"(),
    "updatedAt" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."wallets" OWNER TO "postgres";


ALTER TABLE ONLY "public"."agent_pending_actions"
    ADD CONSTRAINT "agent_pending_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_video_config"
    ADD CONSTRAINT "app_video_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cancellation_fee_config"
    ADD CONSTRAINT "cancellation_fee_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_bank_accounts"
    ADD CONSTRAINT "driver_bank_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_commission_ledger"
    ADD CONSTRAINT "driver_commission_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_document_verification_checks"
    ADD CONSTRAINT "driver_document_verification_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_documents"
    ADD CONSTRAINT "driver_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_online_sessions"
    ADD CONSTRAINT "driver_online_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_payouts"
    ADD CONSTRAINT "driver_payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_ratings_of_riders"
    ADD CONSTRAINT "driver_ratings_of_riders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_ratings_of_riders"
    ADD CONSTRAINT "driver_ratings_of_riders_rideId_driverId_key" UNIQUE ("rideId", "driverId");



ALTER TABLE ONLY "public"."driver_verification_audit_log"
    ADD CONSTRAINT "driver_verification_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_verification_requirements"
    ADD CONSTRAINT "driver_verification_requireme_state_vehicleCategory_documen_key" UNIQUE ("state", "vehicleCategory", "documentType");



ALTER TABLE ONLY "public"."driver_verification_requirements"
    ADD CONSTRAINT "driver_verification_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drivers"
    ADD CONSTRAINT "drivers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drivers"
    ADD CONSTRAINT "drivers_userId_key" UNIQUE ("userId");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_events"
    ADD CONSTRAINT "password_reset_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_intents"
    ADD CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_intents"
    ADD CONSTRAINT "payment_intents_reference_key" UNIQUE ("reference");



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_reconciliation_records"
    ADD CONSTRAINT "payment_reconciliation_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payout_events"
    ADD CONSTRAINT "payout_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payout_manual_actions"
    ADD CONSTRAINT "payout_manual_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payout_provider_attempts"
    ADD CONSTRAINT "payout_provider_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_commission_config"
    ADD CONSTRAINT "platform_commission_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."points_transactions"
    ADD CONSTRAINT "points_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_priority_config"
    ADD CONSTRAINT "pricing_priority_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_tier_config"
    ADD CONSTRAINT "pricing_tier_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_rideId_userId_key" UNIQUE ("rideId", "userId");



ALTER TABLE ONLY "public"."refund_events"
    ADD CONSTRAINT "refund_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refund_intents"
    ADD CONSTRAINT "refund_intents_idempotencyKey_key" UNIQUE ("idempotencyKey");



ALTER TABLE ONLY "public"."refund_intents"
    ADD CONSTRAINT "refund_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refund_intents"
    ADD CONSTRAINT "refund_intents_refundReference_key" UNIQUE ("refundReference");



ALTER TABLE ONLY "public"."refund_provider_attempts"
    ADD CONSTRAINT "refund_provider_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reward_tasks"
    ADD CONSTRAINT "reward_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ride_declines"
    ADD CONSTRAINT "ride_declines_pkey" PRIMARY KEY ("rideId", "driverId");



ALTER TABLE ONLY "public"."rider_preferences"
    ADD CONSTRAINT "rider_preferences_pkey" PRIMARY KEY ("userId");



ALTER TABLE ONLY "public"."rides"
    ADD CONSTRAINT "rides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_locations"
    ADD CONSTRAINT "saved_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_ticket_events"
    ADD CONSTRAINT "support_ticket_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_ticket_messages"
    ADD CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."surge_config"
    ADD CONSTRAINT "surge_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tips"
    ADD CONSTRAINT "tips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."traffic_multiplier_rules"
    ADD CONSTRAINT "traffic_multiplier_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_promo_uses"
    ADD CONSTRAINT "user_promo_uses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId", "role");



ALTER TABLE ONLY "public"."user_task_completions"
    ADD CONSTRAINT "user_task_completions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("uid");



ALTER TABLE ONLY "public"."waiting_charge_config"
    ADD CONSTRAINT "waiting_charge_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_bank_accounts"
    ADD CONSTRAINT "wallet_bank_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_pkey" PRIMARY KEY ("userId");



CREATE INDEX "agent_pending_actions_status_created_idx" ON "public"."agent_pending_actions" USING "btree" ("status", "createdAt" DESC);



CREATE INDEX "idx_audit_driverid" ON "public"."driver_verification_audit_log" USING "btree" ("driverId");



CREATE INDEX "idx_ddvc_documentid" ON "public"."driver_document_verification_checks" USING "btree" ("documentId");



CREATE INDEX "idx_ddvc_driverid" ON "public"."driver_document_verification_checks" USING "btree" ("driverId");



CREATE INDEX "idx_driver_commission_ledger_driver" ON "public"."driver_commission_ledger" USING "btree" ("driverId");



CREATE INDEX "idx_driver_commission_ledger_ride" ON "public"."driver_commission_ledger" USING "btree" ("rideId");



CREATE UNIQUE INDEX "idx_driver_commission_ledger_ride_debit" ON "public"."driver_commission_ledger" USING "btree" ("rideId") WHERE ("type" = 'cash_commission_debit'::"text");



CREATE UNIQUE INDEX "idx_driver_commission_ledger_settlement_reference" ON "public"."driver_commission_ledger" USING "btree" ("reference") WHERE ("type" = 'cash_commission_settlement'::"text");



CREATE INDEX "idx_driver_documents_driverid" ON "public"."driver_documents" USING "btree" ("driverId");



CREATE INDEX "idx_driver_documents_status" ON "public"."driver_documents" USING "btree" ("status");



CREATE INDEX "idx_driver_online_sessions_driverid" ON "public"."driver_online_sessions" USING "btree" ("driverId");



CREATE INDEX "idx_driver_payouts_driver" ON "public"."driver_payouts" USING "btree" ("driverId", "requestedAt" DESC);



CREATE UNIQUE INDEX "idx_driver_payouts_provider_transfer_reference" ON "public"."driver_payouts" USING "btree" ("providerTransferReference") WHERE ("providerTransferReference" IS NOT NULL);



CREATE INDEX "idx_driver_ratings_of_riders_driverid" ON "public"."driver_ratings_of_riders" USING "btree" ("driverId");



CREATE INDEX "idx_driver_ratings_of_riders_userid" ON "public"."driver_ratings_of_riders" USING "btree" ("userId");



CREATE INDEX "idx_drivers_isonline" ON "public"."drivers" USING "btree" ("isOnline");



CREATE INDEX "idx_drivers_online_push" ON "public"."drivers" USING "btree" ("isOnline", "pushToken") WHERE (("isOnline" = true) AND ("pushToken" IS NOT NULL));



CREATE INDEX "idx_drivers_verificationstatus" ON "public"."drivers" USING "btree" ("verificationStatus");



CREATE INDEX "idx_family_members_user_id" ON "public"."family_members" USING "btree" ("userId");



CREATE INDEX "idx_password_reset_events_userid" ON "public"."password_reset_events" USING "btree" ("userId");



CREATE INDEX "idx_payment_events_intent" ON "public"."payment_events" USING "btree" ("paymentIntentId");



CREATE UNIQUE INDEX "idx_payment_events_provider_event_id" ON "public"."payment_events" USING "btree" ("provider", "providerEventId") WHERE ("providerEventId" IS NOT NULL);



CREATE INDEX "idx_payment_events_reference" ON "public"."payment_events" USING "btree" ("reference");



CREATE INDEX "idx_payment_intents_status" ON "public"."payment_intents" USING "btree" ("status");



CREATE INDEX "idx_payment_intents_userid" ON "public"."payment_intents" USING "btree" ("userId");



CREATE INDEX "idx_payment_methods_userid" ON "public"."payment_methods" USING "btree" ("userId");



CREATE INDEX "idx_payment_reconciliation_payout" ON "public"."payment_reconciliation_records" USING "btree" ("payoutId");



CREATE INDEX "idx_payment_reconciliation_refund" ON "public"."payment_reconciliation_records" USING "btree" ("refundId");



CREATE INDEX "idx_payment_reconciliation_status" ON "public"."payment_reconciliation_records" USING "btree" ("reconciliationStatus");



CREATE INDEX "idx_payout_events_payout" ON "public"."payout_events" USING "btree" ("payoutId");



CREATE UNIQUE INDEX "idx_payout_events_provider_event_id" ON "public"."payout_events" USING "btree" ("provider", "providerEventId") WHERE ("providerEventId" IS NOT NULL);



CREATE INDEX "idx_payout_manual_actions_payout" ON "public"."payout_manual_actions" USING "btree" ("payoutId");



CREATE UNIQUE INDEX "idx_payout_provider_attempts_inflight" ON "public"."payout_provider_attempts" USING "btree" ("payoutId") WHERE ("attemptStatus" = 'call_initiated'::"text");



CREATE INDEX "idx_payout_provider_attempts_payout" ON "public"."payout_provider_attempts" USING "btree" ("payoutId");



CREATE INDEX "idx_points_user" ON "public"."points_transactions" USING "btree" ("userId", "createdAt" DESC);



CREATE INDEX "idx_ratings_driverid" ON "public"."ratings" USING "btree" ("driverId");



CREATE INDEX "idx_ratings_userid" ON "public"."ratings" USING "btree" ("userId");



CREATE UNIQUE INDEX "idx_refund_events_provider_event_id" ON "public"."refund_events" USING "btree" ("provider", "providerEventId") WHERE ("providerEventId" IS NOT NULL);



CREATE INDEX "idx_refund_events_refund" ON "public"."refund_events" USING "btree" ("refundId");



CREATE INDEX "idx_refund_intents_payment_intent" ON "public"."refund_intents" USING "btree" ("paymentIntentId");



CREATE INDEX "idx_refund_intents_provider_refund_reference" ON "public"."refund_intents" USING "btree" ("providerRefundReference") WHERE ("providerRefundReference" IS NOT NULL);



CREATE INDEX "idx_refund_intents_ride" ON "public"."refund_intents" USING "btree" ("rideId");



CREATE INDEX "idx_refund_intents_status" ON "public"."refund_intents" USING "btree" ("status");



CREATE INDEX "idx_refund_intents_user" ON "public"."refund_intents" USING "btree" ("userId");



CREATE UNIQUE INDEX "idx_refund_provider_attempts_inflight" ON "public"."refund_provider_attempts" USING "btree" ("refundId") WHERE ("attemptStatus" = 'call_initiated'::"text");



CREATE INDEX "idx_refund_provider_attempts_refund" ON "public"."refund_provider_attempts" USING "btree" ("refundId");



CREATE INDEX "idx_rides_createdat" ON "public"."rides" USING "btree" ("createdAt" DESC);



CREATE INDEX "idx_rides_driverid" ON "public"."rides" USING "btree" ("driverId");



CREATE INDEX "idx_rides_scheduled_for" ON "public"."rides" USING "btree" ("scheduled_for") WHERE ("scheduled_for" IS NOT NULL);



CREATE INDEX "idx_rides_status" ON "public"."rides" USING "btree" ("status");



CREATE INDEX "idx_rides_userid" ON "public"."rides" USING "btree" ("userId");



CREATE INDEX "idx_saved_locations_userid" ON "public"."saved_locations" USING "btree" ("userId");



CREATE INDEX "idx_support_ticket_events_ticketid" ON "public"."support_ticket_events" USING "btree" ("ticketId");



CREATE INDEX "idx_support_ticket_messages_ticketid" ON "public"."support_ticket_messages" USING "btree" ("ticketId");



CREATE INDEX "idx_support_tickets_createdat" ON "public"."support_tickets" USING "btree" ("createdAt" DESC);



CREATE INDEX "idx_support_tickets_filedbyuserid" ON "public"."support_tickets" USING "btree" ("filedByUserId");



CREATE INDEX "idx_support_tickets_status" ON "public"."support_tickets" USING "btree" ("status");



CREATE INDEX "idx_tips_driverid" ON "public"."tips" USING "btree" ("driverId", "status");



CREATE INDEX "idx_tips_rideid" ON "public"."tips" USING "btree" ("rideId");



CREATE UNIQUE INDEX "idx_tips_rider_idempotency" ON "public"."tips" USING "btree" ("riderId", "idempotencyKey");



CREATE UNIQUE INDEX "idx_user_promo_unique" ON "public"."user_promo_uses" USING "btree" ("userId", "promoId");



CREATE INDEX "idx_wallet_bank_accounts_userid" ON "public"."wallet_bank_accounts" USING "btree" ("userId");



CREATE INDEX "idx_wallet_transactions_createdat" ON "public"."wallet_transactions" USING "btree" ("createdAt" DESC);



CREATE UNIQUE INDEX "idx_wallet_transactions_reference_credit" ON "public"."wallet_transactions" USING "btree" ("reference") WHERE (("reference" IS NOT NULL) AND ("type" = ANY (ARRAY['add_money'::"text", 'refund'::"text"])));



CREATE INDEX "idx_wallet_transactions_userid" ON "public"."wallet_transactions" USING "btree" ("userId");



CREATE OR REPLACE TRIGGER "driver_payouts_balance_guard" BEFORE INSERT ON "public"."driver_payouts" FOR EACH ROW EXECUTE FUNCTION "public"."driver_payouts_check_balance"();



CREATE OR REPLACE TRIGGER "driver_payouts_transition_guard" BEFORE UPDATE ON "public"."driver_payouts" FOR EACH ROW EXECUTE FUNCTION "public"."driver_payouts_validate_transition"();



CREATE OR REPLACE TRIGGER "payment_intents_lock_terminal_guard" BEFORE UPDATE ON "public"."payment_intents" FOR EACH ROW EXECUTE FUNCTION "public"."payment_intents_lock_terminal"();



CREATE OR REPLACE TRIGGER "protect_user_role_on_write" BEFORE INSERT OR UPDATE OF "role" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."protect_user_role"();



CREATE OR REPLACE TRIGGER "refund_intents_amount_guard" BEFORE INSERT ON "public"."refund_intents" FOR EACH ROW EXECUTE FUNCTION "public"."refund_intents_check_amount"();



CREATE OR REPLACE TRIGGER "refund_intents_transition_guard" BEFORE UPDATE ON "public"."refund_intents" FOR EACH ROW EXECUTE FUNCTION "public"."refund_intents_validate_transition"();



CREATE OR REPLACE TRIGGER "rides_cash_commission_debit_guard" AFTER UPDATE ON "public"."rides" FOR EACH ROW EXECUTE FUNCTION "public"."rides_cash_commission_debit_trigger"();



CREATE OR REPLACE TRIGGER "rides_cash_dispatch_guard" BEFORE UPDATE ON "public"."rides" FOR EACH ROW EXECUTE FUNCTION "public"."rides_cash_dispatch_guard_trigger"();



CREATE OR REPLACE TRIGGER "rides_protect_financial_columns_guard" BEFORE UPDATE ON "public"."rides" FOR EACH ROW EXECUTE FUNCTION "public"."rides_protect_financial_columns"();



CREATE OR REPLACE TRIGGER "rides_settle_guard" BEFORE UPDATE ON "public"."rides" FOR EACH ROW EXECUTE FUNCTION "public"."rides_settle_trigger"();



CREATE OR REPLACE TRIGGER "sync_user_roles_on_write" AFTER INSERT OR UPDATE OF "role" ON "public"."users" FOR EACH ROW WHEN (("new"."role" IS NOT NULL)) EXECUTE FUNCTION "public"."sync_user_roles"();



CREATE OR REPLACE TRIGGER "trg_enforce_driver_verified_before_online" BEFORE UPDATE ON "public"."drivers" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_driver_verified_before_online"();



CREATE OR REPLACE TRIGGER "trg_enforce_driver_verified_on_accept" BEFORE UPDATE ON "public"."rides" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_driver_verified_on_accept"();



CREATE OR REPLACE TRIGGER "trg_protect_driver_verification_columns" BEFORE UPDATE ON "public"."drivers" FOR EACH ROW EXECUTE FUNCTION "public"."protect_driver_verification_columns"();



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."drivers"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "public"."rides"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("uid");



ALTER TABLE ONLY "public"."driver_commission_ledger"
    ADD CONSTRAINT "driver_commission_ledger_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("uid") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."driver_commission_ledger"
    ADD CONSTRAINT "driver_commission_ledger_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."drivers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."driver_commission_ledger"
    ADD CONSTRAINT "driver_commission_ledger_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "public"."rides"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."driver_document_verification_checks"
    ADD CONSTRAINT "driver_document_verification_checks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."driver_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_document_verification_checks"
    ADD CONSTRAINT "driver_document_verification_checks_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."drivers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_documents"
    ADD CONSTRAINT "driver_documents_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."drivers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_online_sessions"
    ADD CONSTRAINT "driver_online_sessions_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."drivers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_payouts"
    ADD CONSTRAINT "driver_payouts_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "public"."driver_bank_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."driver_ratings_of_riders"
    ADD CONSTRAINT "driver_ratings_of_riders_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."drivers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_ratings_of_riders"
    ADD CONSTRAINT "driver_ratings_of_riders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("uid") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_verification_audit_log"
    ADD CONSTRAINT "driver_verification_audit_log_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."driver_documents"("id");



ALTER TABLE ONLY "public"."driver_verification_audit_log"
    ADD CONSTRAINT "driver_verification_audit_log_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."drivers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."drivers"
    ADD CONSTRAINT "drivers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("uid") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("uid") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."password_reset_events"
    ADD CONSTRAINT "password_reset_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("uid") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "public"."payment_intents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_intents"
    ADD CONSTRAINT "payment_intents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("uid") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("uid") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_reconciliation_records"
    ADD CONSTRAINT "payment_reconciliation_records_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "public"."payment_intents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_reconciliation_records"
    ADD CONSTRAINT "payment_reconciliation_records_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "public"."driver_payouts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_reconciliation_records"
    ADD CONSTRAINT "payment_reconciliation_records_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "public"."refund_intents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payout_events"
    ADD CONSTRAINT "payout_events_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "public"."driver_payouts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payout_manual_actions"
    ADD CONSTRAINT "payout_manual_actions_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "public"."users"("uid") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payout_manual_actions"
    ADD CONSTRAINT "payout_manual_actions_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "public"."driver_payouts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payout_provider_attempts"
    ADD CONSTRAINT "payout_provider_attempts_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "public"."driver_payouts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."drivers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("uid") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refund_events"
    ADD CONSTRAINT "refund_events_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "public"."refund_intents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."refund_intents"
    ADD CONSTRAINT "refund_intents_originalWalletTransactionId_fkey" FOREIGN KEY ("originalWalletTransactionId") REFERENCES "public"."wallet_transactions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."refund_intents"
    ADD CONSTRAINT "refund_intents_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "public"."payment_intents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."refund_intents"
    ADD CONSTRAINT "refund_intents_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "public"."users"("uid") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."refund_intents"
    ADD CONSTRAINT "refund_intents_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "public"."rides"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."refund_intents"
    ADD CONSTRAINT "refund_intents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("uid") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."refund_intents"
    ADD CONSTRAINT "refund_intents_walletTransactionId_fkey" FOREIGN KEY ("walletTransactionId") REFERENCES "public"."wallet_transactions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."refund_provider_attempts"
    ADD CONSTRAINT "refund_provider_attempts_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "public"."refund_intents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ride_declines"
    ADD CONSTRAINT "ride_declines_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."drivers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ride_declines"
    ADD CONSTRAINT "ride_declines_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "public"."rides"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rider_preferences"
    ADD CONSTRAINT "rider_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("uid") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rides"
    ADD CONSTRAINT "rides_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."drivers"("id");



ALTER TABLE ONLY "public"."rides"
    ADD CONSTRAINT "rides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("uid");



ALTER TABLE ONLY "public"."saved_locations"
    ADD CONSTRAINT "saved_locations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("uid") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_ticket_events"
    ADD CONSTRAINT "support_ticket_events_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_ticket_messages"
    ADD CONSTRAINT "support_ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."drivers"("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_filedByUserId_fkey" FOREIGN KEY ("filedByUserId") REFERENCES "public"."users"("uid") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "public"."rides"("id");



ALTER TABLE ONLY "public"."tips"
    ADD CONSTRAINT "tips_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."drivers"("id");



ALTER TABLE ONLY "public"."tips"
    ADD CONSTRAINT "tips_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "public"."rides"("id");



ALTER TABLE ONLY "public"."tips"
    ADD CONSTRAINT "tips_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "public"."users"("uid");



ALTER TABLE ONLY "public"."user_promo_uses"
    ADD CONSTRAINT "user_promo_uses_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "public"."promotions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("uid") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_task_completions"
    ADD CONSTRAINT "user_task_completions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."reward_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_uid_fkey" FOREIGN KEY ("uid") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallet_bank_accounts"
    ADD CONSTRAINT "wallet_bank_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("uid") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "public"."rides"("id");



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("uid") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("uid") ON DELETE RESTRICT;



CREATE POLICY "Allow driver insert" ON "public"."drivers" FOR INSERT WITH CHECK ((("auth"."uid"() = "userId") AND (COALESCE("isVerified", false) = false) AND (COALESCE("verificationStatus", 'PENDING'::"text") = 'PENDING'::"text")));



CREATE POLICY "Allow insert on signup" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "uid"));



CREATE POLICY "Anyone can read cancellation fee config" ON "public"."cancellation_fee_config" FOR SELECT USING (true);



CREATE POLICY "Anyone can read driver verification requirements" ON "public"."driver_verification_requirements" FOR SELECT USING (true);



CREATE POLICY "Anyone can read drivers" ON "public"."drivers" FOR SELECT USING (true);



CREATE POLICY "Anyone can read platform commission config" ON "public"."platform_commission_config" FOR SELECT USING (true);



CREATE POLICY "Anyone can read pricing tier config" ON "public"."pricing_tier_config" FOR SELECT USING (true);



CREATE POLICY "Anyone can read priority config" ON "public"."pricing_priority_config" FOR SELECT USING (true);



CREATE POLICY "Anyone can read surge config" ON "public"."surge_config" FOR SELECT USING (true);



CREATE POLICY "Anyone can read traffic multiplier rules" ON "public"."traffic_multiplier_rules" FOR SELECT USING (true);



CREATE POLICY "Anyone can read waiting charge config" ON "public"."waiting_charge_config" FOR SELECT USING (true);



CREATE POLICY "Driver can insert own declines" ON "public"."ride_declines" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."drivers"
  WHERE (("drivers"."id" = "ride_declines"."driverId") AND ("drivers"."userId" = "auth"."uid"())))));



CREATE POLICY "Driver can read own declines" ON "public"."ride_declines" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."drivers"
  WHERE (("drivers"."id" = "ride_declines"."driverId") AND ("drivers"."userId" = "auth"."uid"())))));



CREATE POLICY "Driver can update own row" ON "public"."drivers" FOR UPDATE USING (("auth"."uid"() = "userId")) WITH CHECK (("auth"."uid"() = "userId"));



CREATE POLICY "Drivers can accept pending rides" ON "public"."rides" FOR UPDATE USING ((("status" = 'pending'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."drivers"
  WHERE ("drivers"."userId" = "auth"."uid"()))))) WITH CHECK (("driverId" IN ( SELECT "drivers"."id"
   FROM "public"."drivers"
  WHERE ("drivers"."userId" = "auth"."uid"()))));



CREATE POLICY "Drivers can close their own online sessions" ON "public"."driver_online_sessions" FOR UPDATE USING (("driverId" IN ( SELECT "drivers"."id"
   FROM "public"."drivers"
  WHERE ("drivers"."userId" = "auth"."uid"())))) WITH CHECK (("driverId" IN ( SELECT "drivers"."id"
   FROM "public"."drivers"
  WHERE ("drivers"."userId" = "auth"."uid"()))));



CREATE POLICY "Drivers can read own audit log" ON "public"."driver_verification_audit_log" FOR SELECT USING (("driverId" IN ( SELECT "drivers"."id"
   FROM "public"."drivers"
  WHERE ("drivers"."userId" = "auth"."uid"()))));



CREATE POLICY "Drivers can read own commission ledger" ON "public"."driver_commission_ledger" FOR SELECT USING (("auth"."uid"() IN ( SELECT "drivers"."userId"
   FROM "public"."drivers"
  WHERE ("drivers"."id" = "driver_commission_ledger"."driverId"))));



CREATE POLICY "Drivers can read own documents" ON "public"."driver_documents" FOR SELECT USING (("driverId" IN ( SELECT "drivers"."id"
   FROM "public"."drivers"
  WHERE ("drivers"."userId" = "auth"."uid"()))));



CREATE POLICY "Drivers can read own verification checks" ON "public"."driver_document_verification_checks" FOR SELECT USING (("driverId" IN ( SELECT "drivers"."id"
   FROM "public"."drivers"
  WHERE ("drivers"."userId" = "auth"."uid"()))));



CREATE POLICY "Drivers can read pending rides" ON "public"."rides" FOR SELECT USING ((("status" = 'pending'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."drivers"
  WHERE ("drivers"."userId" = "auth"."uid"())))));



CREATE POLICY "Drivers can read ratings they gave" ON "public"."driver_ratings_of_riders" FOR SELECT USING (("auth"."uid"() IN ( SELECT "drivers"."userId"
   FROM "public"."drivers"
  WHERE ("drivers"."id" = "driver_ratings_of_riders"."driverId"))));



CREATE POLICY "Drivers can read their own online sessions" ON "public"."driver_online_sessions" FOR SELECT USING (("driverId" IN ( SELECT "drivers"."id"
   FROM "public"."drivers"
  WHERE ("drivers"."userId" = "auth"."uid"()))));



CREATE POLICY "Drivers can read their own ratings" ON "public"."ratings" FOR SELECT USING (("auth"."uid"() IN ( SELECT "drivers"."userId"
   FROM "public"."drivers"
  WHERE ("drivers"."id" = "ratings"."driverId"))));



CREATE POLICY "Drivers can start their own online sessions" ON "public"."driver_online_sessions" FOR INSERT WITH CHECK (("driverId" IN ( SELECT "drivers"."id"
   FROM "public"."drivers"
  WHERE ("drivers"."userId" = "auth"."uid"()))));



CREATE POLICY "Drivers can upload own documents" ON "public"."driver_documents" FOR INSERT WITH CHECK (("driverId" IN ( SELECT "drivers"."id"
   FROM "public"."drivers"
  WHERE ("drivers"."userId" = "auth"."uid"()))));



CREATE POLICY "Drivers can view own tips" ON "public"."tips" FOR SELECT USING (("auth"."uid"() IN ( SELECT "drivers"."userId"
   FROM "public"."drivers"
  WHERE ("drivers"."id" = "tips"."driverId"))));



CREATE POLICY "Rider can read own rides" ON "public"."rides" FOR SELECT USING ((("auth"."uid"() = "userId") OR ("auth"."uid"() IN ( SELECT "drivers"."userId"
   FROM "public"."drivers"
  WHERE ("drivers"."id" = "rides"."driverId")))));



CREATE POLICY "Rider or driver can update ride" ON "public"."rides" FOR UPDATE USING ((("auth"."uid"() = "userId") OR ("auth"."uid"() IN ( SELECT "drivers"."userId"
   FROM "public"."drivers"
  WHERE ("drivers"."id" = "rides"."driverId")))));



CREATE POLICY "Riders can read ratings about themselves" ON "public"."driver_ratings_of_riders" FOR SELECT USING (("auth"."uid"() = "userId"));



CREATE POLICY "Riders can view own tips" ON "public"."tips" FOR SELECT USING (("auth"."uid"() = "riderId"));



CREATE POLICY "Users can create own wallet" ON "public"."wallets" FOR INSERT WITH CHECK ((("auth"."uid"() = "userId") AND ("balance" = (0)::numeric)));



CREATE POLICY "Users can delete own bank accounts" ON "public"."wallet_bank_accounts" FOR DELETE USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can delete own payment methods" ON "public"."payment_methods" FOR DELETE USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can delete own saved locations" ON "public"."saved_locations" FOR DELETE USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can insert own payment methods" ON "public"."payment_methods" FOR INSERT WITH CHECK (("auth"."uid"() = "userId"));



CREATE POLICY "Users can insert own saved locations" ON "public"."saved_locations" FOR INSERT WITH CHECK (("auth"."uid"() = "userId"));



CREATE POLICY "Users can read events on own tickets" ON "public"."support_ticket_events" FOR SELECT USING (("ticketId" IN ( SELECT "support_tickets"."id"
   FROM "public"."support_tickets"
  WHERE ("support_tickets"."filedByUserId" = "auth"."uid"()))));



CREATE POLICY "Users can read messages on own tickets" ON "public"."support_ticket_messages" FOR SELECT USING (("ticketId" IN ( SELECT "support_tickets"."id"
   FROM "public"."support_tickets"
  WHERE ("support_tickets"."filedByUserId" = "auth"."uid"()))));



CREATE POLICY "Users can read own bank accounts" ON "public"."wallet_bank_accounts" FOR SELECT USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can read own payment intents" ON "public"."payment_intents" FOR SELECT USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can read own payment methods" ON "public"."payment_methods" FOR SELECT USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can read own profile" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "uid"));



CREATE POLICY "Users can read own ratings" ON "public"."ratings" FOR SELECT USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can read own refunds" ON "public"."refund_intents" FOR SELECT USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can read own saved locations" ON "public"."saved_locations" FOR SELECT USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can read own tickets" ON "public"."support_tickets" FOR SELECT USING (("auth"."uid"() = "filedByUserId"));



CREATE POLICY "Users can read own wallet" ON "public"."wallets" FOR SELECT USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can read own wallet transactions" ON "public"."wallet_transactions" FOR SELECT USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can update own payment methods" ON "public"."payment_methods" FOR UPDATE USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "uid"));



CREATE POLICY "Users can update own saved locations" ON "public"."saved_locations" FOR UPDATE USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users manage own family members" ON "public"."family_members" USING (("auth"."uid"() = "userId")) WITH CHECK (("auth"."uid"() = "userId"));



CREATE POLICY "Users manage own password reset events" ON "public"."password_reset_events" USING (("auth"."uid"() = "userId")) WITH CHECK (("auth"."uid"() = "userId"));



CREATE POLICY "Users manage own rider preferences" ON "public"."rider_preferences" USING (("auth"."uid"() = "userId")) WITH CHECK (("auth"."uid"() = "userId"));



ALTER TABLE "public"."agent_pending_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_video_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_video_config_select" ON "public"."app_video_config" FOR SELECT USING (true);



ALTER TABLE "public"."cancellation_fee_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "completions_own" ON "public"."user_task_completions" USING ((("auth"."uid"())::"text" = "userId"));



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_bank_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_commission_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_document_verification_checks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_online_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_payouts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "driver_payouts_select_own" ON "public"."driver_payouts" FOR SELECT USING (("auth"."uid"() IN ( SELECT "drivers"."userId"
   FROM "public"."drivers"
  WHERE ("drivers"."id" = ("driver_payouts"."driverId")::"uuid"))));



ALTER TABLE "public"."driver_ratings_of_riders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_verification_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_verification_requirements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."drivers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."password_reset_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_intents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_methods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_reconciliation_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payout_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payout_manual_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payout_provider_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_commission_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "points_own" ON "public"."points_transactions" USING ((("auth"."uid"())::"text" = "userId"));



ALTER TABLE "public"."points_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_priority_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_tier_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promotions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promotions_read" ON "public"."promotions" FOR SELECT USING ((("isActive" = true) AND ("validUntil" > "now"())));



ALTER TABLE "public"."ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."refund_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."refund_intents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."refund_provider_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reward_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_declines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rider_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_ticket_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_ticket_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."surge_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasks_read" ON "public"."reward_tasks" FOR SELECT USING ((("isActive" = true) AND (("validUntil" IS NULL) OR ("validUntil" > "now"()))));



ALTER TABLE "public"."tips" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."traffic_multiplier_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_promo_uses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_promo_uses_own" ON "public"."user_promo_uses" USING ((("auth"."uid"())::"text" = "userId"));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_read_own" ON "public"."user_roles" FOR SELECT USING (("auth"."uid"() = "userId"));



ALTER TABLE "public"."user_task_completions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waiting_charge_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallet_bank_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallet_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallets" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON TABLE "public"."wallet_transactions" TO "anon";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_wallet_transaction"("p_user_id" "uuid", "p_type" "text", "p_amount" numeric, "p_description" "text", "p_status" "text", "p_ride_id" "uuid", "p_payment_method_id" "text", "p_reference" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."add_wallet_transaction"("p_user_id" "uuid", "p_type" "text", "p_amount" numeric, "p_description" "text", "p_status" "text", "p_ride_id" "uuid", "p_payment_method_id" "text", "p_reference" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_wallet_transaction"("p_user_id" "uuid", "p_type" "text", "p_amount" numeric, "p_description" "text", "p_status" "text", "p_ride_id" "uuid", "p_payment_method_id" "text", "p_reference" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."tips" TO "anon";
GRANT ALL ON TABLE "public"."tips" TO "authenticated";
GRANT ALL ON TABLE "public"."tips" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_tip"("p_rider_id" "uuid", "p_ride_id" "uuid", "p_driver_id" "uuid", "p_amount" numeric, "p_payment_method" "text", "p_idempotency_key" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_tip"("p_rider_id" "uuid", "p_ride_id" "uuid", "p_driver_id" "uuid", "p_amount" numeric, "p_payment_method" "text", "p_idempotency_key" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_tip"("p_rider_id" "uuid", "p_ride_id" "uuid", "p_driver_id" "uuid", "p_amount" numeric, "p_payment_method" "text", "p_idempotency_key" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."driver_payouts_check_balance"() TO "anon";
GRANT ALL ON FUNCTION "public"."driver_payouts_check_balance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."driver_payouts_check_balance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."driver_payouts_validate_transition"() TO "anon";
GRANT ALL ON FUNCTION "public"."driver_payouts_validate_transition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."driver_payouts_validate_transition"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_driver_verified_before_online"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_driver_verified_before_online"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_driver_verified_before_online"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_driver_verified_on_accept"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_driver_verified_on_accept"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_driver_verified_on_accept"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_driver_available_balance"("driver_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_driver_available_balance"("driver_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_driver_available_balance"("driver_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_driver_cash_debt_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_driver_cash_debt_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_driver_cash_debt_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_driver_net_balance"("driver_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_driver_net_balance"("driver_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_driver_net_balance"("driver_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_drivers_commission_summary"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_drivers_commission_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_promo_use"("promo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_promo_use"("promo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_promo_use"("promo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."payment_intents_lock_terminal"() TO "anon";
GRANT ALL ON FUNCTION "public"."payment_intents_lock_terminal"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."payment_intents_lock_terminal"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_driver_verification_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_driver_verification_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_driver_verification_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refund_intents_check_amount"() TO "anon";
GRANT ALL ON FUNCTION "public"."refund_intents_check_amount"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refund_intents_check_amount"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refund_intents_validate_transition"() TO "anon";
GRANT ALL ON FUNCTION "public"."refund_intents_validate_transition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refund_intents_validate_transition"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ride_payment_is_cash"("p_payment_method" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ride_payment_is_cash"("p_payment_method" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ride_payment_is_cash"("p_payment_method" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rides_cash_commission_debit_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."rides_cash_commission_debit_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rides_cash_commission_debit_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rides_cash_dispatch_guard_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."rides_cash_dispatch_guard_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rides_cash_dispatch_guard_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rides_protect_financial_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."rides_protect_financial_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rides_protect_financial_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rides_settle_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."rides_settle_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rides_settle_trigger"() TO "service_role";



GRANT ALL ON TABLE "public"."ratings" TO "anon";
GRANT ALL ON TABLE "public"."ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."ratings" TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_rating"("p_ride_id" "text", "p_driver_id" "uuid", "p_rating" numeric, "p_comment" "text", "p_tags" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."submit_rating"("p_ride_id" "text", "p_driver_id" "uuid", "p_rating" numeric, "p_comment" "text", "p_tags" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_rating"("p_ride_id" "text", "p_driver_id" "uuid", "p_rating" numeric, "p_comment" "text", "p_tags" "text"[]) TO "service_role";



GRANT ALL ON TABLE "public"."driver_ratings_of_riders" TO "anon";
GRANT ALL ON TABLE "public"."driver_ratings_of_riders" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_ratings_of_riders" TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_rider_rating"("p_ride_id" "text", "p_user_id" "uuid", "p_rating" numeric, "p_comment" "text", "p_tags" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."submit_rider_rating"("p_ride_id" "text", "p_user_id" "uuid", "p_rating" numeric, "p_comment" "text", "p_tags" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_rider_rating"("p_ride_id" "text", "p_user_id" "uuid", "p_rating" numeric, "p_comment" "text", "p_tags" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_roles"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_roles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_roles"() TO "service_role";


















GRANT ALL ON TABLE "public"."agent_pending_actions" TO "anon";
GRANT ALL ON TABLE "public"."agent_pending_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_pending_actions" TO "service_role";



GRANT ALL ON TABLE "public"."app_video_config" TO "anon";
GRANT ALL ON TABLE "public"."app_video_config" TO "authenticated";
GRANT ALL ON TABLE "public"."app_video_config" TO "service_role";



GRANT ALL ON TABLE "public"."cancellation_fee_config" TO "anon";
GRANT ALL ON TABLE "public"."cancellation_fee_config" TO "authenticated";
GRANT ALL ON TABLE "public"."cancellation_fee_config" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."driver_bank_accounts" TO "anon";
GRANT ALL ON TABLE "public"."driver_bank_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_bank_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."driver_commission_ledger" TO "anon";
GRANT ALL ON TABLE "public"."driver_commission_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_commission_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."driver_document_verification_checks" TO "anon";
GRANT ALL ON TABLE "public"."driver_document_verification_checks" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_document_verification_checks" TO "service_role";



GRANT ALL ON TABLE "public"."driver_documents" TO "anon";
GRANT ALL ON TABLE "public"."driver_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_documents" TO "service_role";



GRANT ALL ON TABLE "public"."driver_online_sessions" TO "anon";
GRANT ALL ON TABLE "public"."driver_online_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_online_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."driver_payouts" TO "anon";
GRANT ALL ON TABLE "public"."driver_payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_payouts" TO "service_role";



GRANT ALL ON TABLE "public"."driver_verification_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."driver_verification_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_verification_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."driver_verification_requirements" TO "anon";
GRANT ALL ON TABLE "public"."driver_verification_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_verification_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."drivers" TO "anon";
GRANT ALL ON TABLE "public"."drivers" TO "authenticated";
GRANT ALL ON TABLE "public"."drivers" TO "service_role";



GRANT ALL ON TABLE "public"."family_members" TO "anon";
GRANT ALL ON TABLE "public"."family_members" TO "authenticated";
GRANT ALL ON TABLE "public"."family_members" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."password_reset_events" TO "anon";
GRANT ALL ON TABLE "public"."password_reset_events" TO "authenticated";
GRANT ALL ON TABLE "public"."password_reset_events" TO "service_role";



GRANT ALL ON TABLE "public"."payment_events" TO "anon";
GRANT ALL ON TABLE "public"."payment_events" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_events" TO "service_role";



GRANT ALL ON TABLE "public"."payment_intents" TO "anon";
GRANT ALL ON TABLE "public"."payment_intents" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_intents" TO "service_role";



GRANT ALL ON TABLE "public"."payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_methods" TO "service_role";



GRANT ALL ON TABLE "public"."payment_reconciliation_records" TO "anon";
GRANT ALL ON TABLE "public"."payment_reconciliation_records" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_reconciliation_records" TO "service_role";



GRANT ALL ON TABLE "public"."payout_events" TO "anon";
GRANT ALL ON TABLE "public"."payout_events" TO "authenticated";
GRANT ALL ON TABLE "public"."payout_events" TO "service_role";



GRANT ALL ON TABLE "public"."payout_manual_actions" TO "anon";
GRANT ALL ON TABLE "public"."payout_manual_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."payout_manual_actions" TO "service_role";



GRANT ALL ON TABLE "public"."payout_provider_attempts" TO "anon";
GRANT ALL ON TABLE "public"."payout_provider_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."payout_provider_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."platform_commission_config" TO "anon";
GRANT ALL ON TABLE "public"."platform_commission_config" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_commission_config" TO "service_role";



GRANT ALL ON TABLE "public"."points_transactions" TO "anon";
GRANT ALL ON TABLE "public"."points_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."points_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_priority_config" TO "anon";
GRANT ALL ON TABLE "public"."pricing_priority_config" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_priority_config" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_tier_config" TO "anon";
GRANT ALL ON TABLE "public"."pricing_tier_config" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_tier_config" TO "service_role";



GRANT ALL ON TABLE "public"."promotions" TO "anon";
GRANT ALL ON TABLE "public"."promotions" TO "authenticated";
GRANT ALL ON TABLE "public"."promotions" TO "service_role";



GRANT ALL ON TABLE "public"."refund_events" TO "anon";
GRANT ALL ON TABLE "public"."refund_events" TO "authenticated";
GRANT ALL ON TABLE "public"."refund_events" TO "service_role";



GRANT ALL ON TABLE "public"."refund_intents" TO "anon";
GRANT ALL ON TABLE "public"."refund_intents" TO "authenticated";
GRANT ALL ON TABLE "public"."refund_intents" TO "service_role";



GRANT ALL ON TABLE "public"."refund_provider_attempts" TO "anon";
GRANT ALL ON TABLE "public"."refund_provider_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."refund_provider_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."reward_tasks" TO "anon";
GRANT ALL ON TABLE "public"."reward_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."reward_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."ride_declines" TO "anon";
GRANT ALL ON TABLE "public"."ride_declines" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_declines" TO "service_role";



GRANT ALL ON TABLE "public"."rider_preferences" TO "anon";
GRANT ALL ON TABLE "public"."rider_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."rider_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."rides" TO "anon";
GRANT ALL ON TABLE "public"."rides" TO "authenticated";
GRANT ALL ON TABLE "public"."rides" TO "service_role";



GRANT ALL ON TABLE "public"."saved_locations" TO "anon";
GRANT ALL ON TABLE "public"."saved_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_locations" TO "service_role";



GRANT ALL ON TABLE "public"."support_ticket_events" TO "anon";
GRANT ALL ON TABLE "public"."support_ticket_events" TO "authenticated";
GRANT ALL ON TABLE "public"."support_ticket_events" TO "service_role";



GRANT ALL ON TABLE "public"."support_ticket_messages" TO "anon";
GRANT ALL ON TABLE "public"."support_ticket_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."support_ticket_messages" TO "service_role";



GRANT ALL ON TABLE "public"."support_tickets" TO "anon";
GRANT ALL ON TABLE "public"."support_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."support_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."surge_config" TO "anon";
GRANT ALL ON TABLE "public"."surge_config" TO "authenticated";
GRANT ALL ON TABLE "public"."surge_config" TO "service_role";



GRANT ALL ON TABLE "public"."traffic_multiplier_rules" TO "anon";
GRANT ALL ON TABLE "public"."traffic_multiplier_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."traffic_multiplier_rules" TO "service_role";



GRANT ALL ON TABLE "public"."user_points_balance" TO "anon";
GRANT ALL ON TABLE "public"."user_points_balance" TO "authenticated";
GRANT ALL ON TABLE "public"."user_points_balance" TO "service_role";



GRANT ALL ON TABLE "public"."user_promo_uses" TO "anon";
GRANT ALL ON TABLE "public"."user_promo_uses" TO "authenticated";
GRANT ALL ON TABLE "public"."user_promo_uses" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_task_completions" TO "anon";
GRANT ALL ON TABLE "public"."user_task_completions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_task_completions" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."waiting_charge_config" TO "anon";
GRANT ALL ON TABLE "public"."waiting_charge_config" TO "authenticated";
GRANT ALL ON TABLE "public"."waiting_charge_config" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_bank_accounts" TO "anon";
GRANT ALL ON TABLE "public"."wallet_bank_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_bank_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."wallets" TO "anon";
GRANT ALL ON TABLE "public"."wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."wallets" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

































-- ------------------------------------------------------------
-- Pantra objects in the auth and storage schemas
-- ------------------------------------------------------------

CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();

CREATE POLICY "Drivers can upload to own document folder" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'documents'::"text") AND (("storage"."foldername"("name"))[1] = 'drivers'::"text") AND (("storage"."foldername"("name"))[2] IN ( SELECT ("drivers"."id")::"text" AS "id"
   FROM "public"."drivers"
  WHERE ("drivers"."userId" = "auth"."uid"())))));



CREATE POLICY "Drivers can view own document folder" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'documents'::"text") AND (("storage"."foldername"("name"))[1] = 'drivers'::"text") AND (("storage"."foldername"("name"))[2] IN ( SELECT ("drivers"."id")::"text" AS "id"
   FROM "public"."drivers"
  WHERE ("drivers"."userId" = "auth"."uid"())))));

