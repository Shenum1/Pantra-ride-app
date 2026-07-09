-- Migration: add pushToken columns to users and drivers tables
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "pushToken" TEXT;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS "pushToken" TEXT;

-- Index so the backend can quickly find all online drivers with a push token
CREATE INDEX IF NOT EXISTS idx_drivers_online_push
  ON public.drivers ("isOnline", "pushToken")
  WHERE "isOnline" = TRUE AND "pushToken" IS NOT NULL;
