-- Migration: multi-role support (a single account can hold more than one role —
-- e.g. an existing rider who also registers as a driver). Additive only: does not
-- touch users.role (kept as each account's default/primary experience) or any
-- existing driver/verification tables.
--
-- IMPORTANT: run this migration (including the backfill) and confirm it succeeded
-- BEFORE deploying the backend-code change that swaps driverProcedure/adminProcedure
-- to check this table — see backend/trpc/create-context.ts. Deploying the code first
-- would briefly block every existing driver/admin from driver-verification and admin
-- routes (not from driving/earning — that's enforced by DB triggers on `drivers`,
-- unaffected by this) until the backfill catches up.

CREATE TABLE IF NOT EXISTS user_roles (
  "userId"    UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('rider', 'driver', 'admin')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", role)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- A user can see which roles their own account holds. Only the service-role
-- backend can grant/revoke a role (see driver-verification.becomeDriver route) —
-- never a plain client insert, since a role grant is a security-relevant decision.
CREATE POLICY "user_roles_read_own" ON user_roles FOR SELECT
  USING (auth.uid() = "userId");

-- Backfill: give every existing account a role row matching its current
-- single-value users.role, so the cutover doesn't strand anyone.
INSERT INTO user_roles ("userId", role)
SELECT uid, role FROM users
WHERE role IN ('rider', 'driver', 'admin')
ON CONFLICT DO NOTHING;

-- Keeps user_roles in sync with users.role going forward, so every new signup
-- (rider or driver) automatically gets its matching user_roles row too — no
-- application code needs to write to user_roles for a plain single-role signup.
-- SECURITY DEFINER + table-owner privileges let this insert succeed regardless
-- of user_roles' own RLS policy, without granting the client any new write path:
-- a client can still only ever cause ONE role to appear this way (whatever it
-- writes to users.role, same as before this migration) — a SECOND role on an
-- account (e.g. an existing rider becoming a driver) can only be added by the
-- service-role-only driver-verification.becomeDriver route.
CREATE OR REPLACE FUNCTION sync_user_roles() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_roles ("userId", role)
  VALUES (NEW.uid, NEW.role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_user_roles_on_write ON users;
CREATE TRIGGER sync_user_roles_on_write
  AFTER INSERT OR UPDATE OF role ON users
  FOR EACH ROW
  WHEN (NEW.role IS NOT NULL)
  EXECUTE FUNCTION sync_user_roles();
