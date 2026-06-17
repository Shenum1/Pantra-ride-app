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

CREATE POLICY "driver_bank_accounts_own" ON driver_bank_accounts
  FOR ALL USING (auth.uid()::text = "driverId");

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

CREATE POLICY "driver_payouts_own" ON driver_payouts
  FOR ALL USING (auth.uid()::text = "driverId");

-- Index for fast payout history per driver
CREATE INDEX IF NOT EXISTS idx_driver_payouts_driver
  ON driver_payouts ("driverId", "requestedAt" DESC);
