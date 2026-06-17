-- Migration: points/rewards system (tasks + completions + ledger)
-- Run once in Supabase Dashboard > SQL Editor

-- Task definitions — created by admin via Supabase dashboard
CREATE TABLE IF NOT EXISTS reward_tasks (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                    TEXT NOT NULL CHECK (type IN ('youtube_video', 'social_share')),
  title                   TEXT NOT NULL,
  description             TEXT NOT NULL,
  url                     TEXT,
  "pointsReward"          INTEGER NOT NULL,
  "minWatchSeconds"       INTEGER,
  "maxCompletionsPerUser" INTEGER NOT NULL DEFAULT 1,
  "totalMaxCompletions"   INTEGER,
  "completedCount"        INTEGER NOT NULL DEFAULT 0,
  "isActive"              BOOLEAN NOT NULL DEFAULT true,
  "validUntil"            TIMESTAMPTZ,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE reward_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_read" ON reward_tasks FOR SELECT
  USING ("isActive" = true AND ("validUntil" IS NULL OR "validUntil" > now()));

-- Per-user task completion records
CREATE TABLE IF NOT EXISTS user_task_completions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"       TEXT NOT NULL,
  "taskId"       UUID NOT NULL REFERENCES reward_tasks(id) ON DELETE CASCADE,
  "pointsEarned" INTEGER NOT NULL,
  "completedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "completions_own" ON user_task_completions
  FOR ALL USING (auth.uid()::text = "userId");

-- Points ledger: every earn (+) and spend (-) row
CREATE TABLE IF NOT EXISTS points_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"       TEXT NOT NULL,
  amount         INTEGER NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('task_reward', 'ride_redemption', 'expiry')),
  "referenceId"  TEXT,
  description    TEXT NOT NULL,
  "expiresAt"    TIMESTAMPTZ,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "points_own" ON points_transactions
  FOR ALL USING (auth.uid()::text = "userId");

CREATE INDEX IF NOT EXISTS idx_points_user
  ON points_transactions ("userId", "createdAt" DESC);

-- Live balance view (excludes expired earn rows)
CREATE OR REPLACE VIEW user_points_balance AS
SELECT "userId",
       COALESCE(SUM(amount), 0)::INTEGER AS balance
FROM points_transactions
WHERE ("expiresAt" IS NULL OR "expiresAt" > now())
GROUP BY "userId";

-- Seed one example YouTube task so the rewards screen isn't empty
INSERT INTO reward_tasks (type, title, description, "pointsReward", "minWatchSeconds")
VALUES (
  'youtube_video',
  'Watch: Introducing Pantra Ride',
  'Watch our short introduction video and earn 500 points worth ₦8,000 in ride credit!',
  500,
  120
)
ON CONFLICT DO NOTHING;
