-- Migration: promo codes backend
-- Run once in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS promotions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT NOT NULL UNIQUE,
  description          TEXT NOT NULL,
  "discountPercentage" NUMERIC(5,2) NOT NULL,
  "maxDiscountNGN"     NUMERIC(10,2),
  "maxUses"            INTEGER,
  "usedCount"          INTEGER NOT NULL DEFAULT 0,
  "validFrom"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "validUntil"         TIMESTAMPTZ NOT NULL,
  "isActive"           BOOLEAN NOT NULL DEFAULT true,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotions_read" ON promotions FOR SELECT
  USING ("isActive" = true AND "validUntil" > now());

CREATE TABLE IF NOT EXISTS user_promo_uses (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"  TEXT NOT NULL,
  "promoId" UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  "rideId"  TEXT,
  "usedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_promo_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_promo_uses_own" ON user_promo_uses
  FOR ALL USING (auth.uid()::text = "userId");

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_promo_unique
  ON user_promo_uses ("userId", "promoId");

-- Safely increments use count; called via supabase.rpc()
CREATE OR REPLACE FUNCTION increment_promo_use(promo_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE promotions SET "usedCount" = "usedCount" + 1 WHERE id = promo_id;
$$;

-- Seed the 3 dev codes with current expiry dates
INSERT INTO promotions (code, description, "discountPercentage", "maxDiscountNGN", "validUntil")
VALUES
  ('WELCOME50', '50% off your first ride', 50, 1000, '2026-12-31'),
  ('WEEKEND25', '25% off weekend rides',   25,  500, '2026-12-31'),
  ('BOLT15',    '15% off any ride',         15,  300, '2026-12-31')
ON CONFLICT (code) DO NOTHING;
