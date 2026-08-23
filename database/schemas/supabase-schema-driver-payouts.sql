-- Migration: driver bank accounts + payout requests
-- Run once in Supabase Dashboard > SQL Editor

-- Driver bank accounts (saved by the driver, reviewed manually before payout)
CREATE TABLE IF NOT EXISTS driver_bank_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "driverId"    TEXT NOT NULL,
  "bankName"    TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "isDefault"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE driver_bank_accounts ENABLE ROW LEVEL SECURITY;

-- "driverId" here (and on driver_payouts below) stores drivers.id — the
-- driver profile's own primary key, e.g. from useDriverAuthStore's
-- DriverRow.id / driverProcedure's ctx.driverId — which is a separate
-- generated uuid from drivers.userId (the auth.uid() that's actually logged
-- in). Comparing auth.uid() directly to "driverId" (as a previous version of
-- this policy did) never matches anyone; ownership has to be resolved
-- through drivers.userId, the same join already used for the rides/drivers
-- policies in supabase-schema.sql.
DROP POLICY IF EXISTS "driver_bank_accounts_own" ON driver_bank_accounts;
CREATE POLICY "driver_bank_accounts_own" ON driver_bank_accounts
  FOR ALL USING (
    auth.uid() in (select "userId" from public.drivers where "id" = "driverId"::uuid)
  );

-- Payout requests — status updated manually by admin
CREATE TABLE IF NOT EXISTS driver_payouts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "driverId"      TEXT NOT NULL,
  amount          NUMERIC(12, 2) NOT NULL,
  "bankAccountId" UUID REFERENCES driver_bank_accounts(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  "failureReason" TEXT,
  "requestedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completedAt"   TIMESTAMPTZ
);

ALTER TABLE driver_payouts ENABLE ROW LEVEL SECURITY;

-- Was previously a single "FOR ALL" policy, which covers UPDATE/DELETE too —
-- letting a driver's own client session set their own payout's status to
-- 'completed' directly, bypassing admin approval
-- (backend/trpc/routes/admin/payouts/update-status/route.ts) entirely. Split
-- into read + insert only: a driver may see and request their own payouts,
-- never change or remove them once submitted. The admin route is unaffected
-- — it runs through adminProcedure, which uses the service-role client and
-- therefore bypasses RLS. Also fixes the same auth.uid()-vs-drivers.id
-- mismatch described above on driver_bank_accounts — the old predicate never
-- matched a real driver session.
DROP POLICY IF EXISTS "driver_payouts_own" ON driver_payouts;

DROP POLICY IF EXISTS "driver_payouts_select_own" ON driver_payouts;
CREATE POLICY "driver_payouts_select_own" ON driver_payouts
  FOR SELECT USING (
    auth.uid() in (select "userId" from public.drivers where "id" = "driverId"::uuid)
  );

DROP POLICY IF EXISTS "driver_payouts_insert_own" ON driver_payouts;
CREATE POLICY "driver_payouts_insert_own" ON driver_payouts
  FOR INSERT WITH CHECK (
    auth.uid() in (select "userId" from public.drivers where "id" = "driverId"::uuid)
  );

-- Index for fast payout history per driver
CREATE INDEX IF NOT EXISTS idx_driver_payouts_driver
  ON driver_payouts ("driverId", "requestedAt" DESC);

-- A driver's spendable balance: what they've actually earned from settled,
-- paid rides, minus every payout already in flight or paid out. Payouts that
-- are still 'pending'/'processing' count against this too (not just
-- 'completed') — otherwise a driver could file several withdrawal requests
-- against the same earnings before admin gets to any of them. No separate
-- ledger table is introduced; this is a derived read over the existing
-- rides/driver_payouts data, consistent with how driver earnings already
-- work (computed, not stored as a running balance).
CREATE OR REPLACE FUNCTION public.get_driver_available_balance(driver_id text)
RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT GREATEST(
    COALESCE((
      SELECT SUM(r."driverEarningsAmount")
      FROM public.rides r
      WHERE r."driverId"::text = driver_id
        AND r."status" = 'completed'
        AND r."paymentStatus" = 'paid'
    ), 0)
    - COALESCE((
      SELECT SUM(p."amount")
      FROM public.driver_payouts p
      WHERE p."driverId" = driver_id
        AND p."status" IN ('pending', 'processing', 'completed')
    ), 0),
    0
  );
$$;

-- Server-side guard: a payout request can never exceed the driver's
-- available balance, and this is enforced at insert time (not just in the
-- app UI, which only ever saw a client-computed estimate). Two payout
-- requests for the same driver submitted at nearly the same time (two
-- devices, a double-tap that got past the UI's own debounce, etc.) are
-- serialized with a transaction-scoped advisory lock keyed by driverId —
-- the second request blocks until the first commits (or rolls back), so its
-- balance check always sees the first request's row and can't approve two
-- withdrawals that together overdraw the same earnings.
CREATE OR REPLACE FUNCTION public.driver_payouts_check_balance()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW."driverId"));

  IF NEW."amount" > public.get_driver_available_balance(NEW."driverId") THEN
    RAISE EXCEPTION 'payout amount % exceeds available balance', NEW."amount";
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS driver_payouts_balance_guard ON driver_payouts;
CREATE TRIGGER driver_payouts_balance_guard
  BEFORE INSERT ON driver_payouts
  FOR EACH ROW EXECUTE FUNCTION public.driver_payouts_check_balance();
