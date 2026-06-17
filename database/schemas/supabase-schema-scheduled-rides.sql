-- Migration: add scheduled_for column to rides table
-- Run once in Supabase Dashboard > SQL Editor

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

-- Index for querying upcoming scheduled rides per user
CREATE INDEX IF NOT EXISTS idx_rides_scheduled_for
  ON rides (scheduled_for)
  WHERE scheduled_for IS NOT NULL;
