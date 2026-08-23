-- Migration: adds 'ad_reward' as a valid points_transactions type, for the
-- watch-a-rewarded-ad-to-earn-points feature (backend/trpc/routes/rewards/).
-- Run once in Supabase Dashboard > SQL Editor, after supabase-schema-rewards.sql.

ALTER TABLE points_transactions DROP CONSTRAINT IF EXISTS points_transactions_type_check;

ALTER TABLE points_transactions
  ADD CONSTRAINT points_transactions_type_check
  CHECK (type IN ('task_reward', 'ride_redemption', 'expiry', 'ad_reward'));
