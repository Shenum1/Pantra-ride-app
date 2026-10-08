import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Source guards on database/schemas/supabase-schema-security-hardening.sql (no
// Postgres test harness in this codebase), plus checks that the client no
// longer relies on the reads/writes the migration closes.
const root = process.cwd();
// Normalise CRLF: Windows checkouts (core.autocrlf) would otherwise break the
// '\n'-anchored parsing below.
const read = (rel: string) => fs.readFileSync(path.resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');

const sql = read('database/schemas/supabase-schema-security-hardening.sql');
// Executable SQL only — the "how to verify" block at the bottom is all comments.
const code = sql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

// Body of one `create or replace function public.<name>(...) ... $$ ... $$;`
function fnBlock(name: string): string {
  const start = code.indexOf(`create or replace function public.${name}(`);
  expect(start, `function ${name} missing`).toBeGreaterThan(-1);
  const bodyStart = code.indexOf('$$', start);
  const bodyEnd = code.indexOf('$$;', bodyStart + 2);
  return code.slice(start, bodyEnd + 3);
}

// Text of one `create policy "<name>" ...;`
function policyBlock(name: string): string {
  const start = code.indexOf(`create policy "${name}"`);
  expect(start, `policy ${name} missing`).toBeGreaterThan(-1);
  return code.slice(start, code.indexOf(';', start) + 1);
}

// The column list a `returns table (...)` function exposes.
function returnedColumns(name: string): string[] {
  const block = fnBlock(name);
  const open = block.indexOf('returns table (');
  const close = block.indexOf(')\nlanguage', open);
  return [...block.slice(open, close).matchAll(/"(\w+)"\s+\w+/g)].map((m) => m[1]);
}

const PRIVATE_DRIVER_COLUMNS = [
  'email', 'phone', 'pushToken', 'fullLegalName', 'dateOfBirth', 'licenseNumber', 'licenseCategory',
  'licenseIssueDate', 'licenseExpiryDate', 'vehicleVin', 'vehicleEngineNumber', 'rejectionReason',
  'earnings', 'documents', 'userId', 'operatingState', 'phoneVerifiedAt', 'emailVerifiedAt',
];

describe('security hardening migration — general', () => {
  it('never declares a wide-open policy', () => {
    expect(code).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(code).not.toMatch(/with check\s*\(\s*true\s*\)/i);
  });

  it('is idempotent: every created policy and trigger is dropped first', () => {
    for (const m of code.matchAll(/create policy "([^"]+)"\s+on (public\.\w+)/g)) {
      expect(code).toContain(`drop policy if exists "${m[1]}" on ${m[2]};`);
    }
    for (const m of code.matchAll(/create trigger (\w+)/g)) {
      expect(code).toMatch(new RegExp(`drop trigger if exists ${m[1]} on public\\.\\w+;`));
    }
    expect(code).not.toMatch(/^create function/m);
    expect(code).toContain('create table if not exists public.pending_ride_signals');
  });

  it('every SECURITY DEFINER function pins its search_path', () => {
    for (const m of code.matchAll(/create or replace function public\.(\w+)\(/g)) {
      const block = fnBlock(m[1]);
      if (block.includes('security definer')) {
        expect(block, m[1]).toContain('set search_path = public');
      }
    }
  });

  it('anon gets no table access and cannot execute the new RPCs', () => {
    for (const table of ['drivers', 'rides', 'conversations', 'messages', 'pending_ride_signals']) {
      expect(code).toContain(`revoke all on table public.${table}`);
    }
    for (const fn of [
      'get_nearby_drivers', 'get_ride_driver', 'get_pending_rides_for_driver',
      'get_ride_rider_for_driver', 'accept_ride', 'get_marketplace_demand_counts',
    ]) {
      expect(code).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\)\\s+from public, anon;`));
      expect(code).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\)\\s+to authenticated;`));
      expect(fnBlock(fn), fn).toMatch(/auth\.uid\(\) is (not )?null/);
    }
  });

  it('does not touch users.role / handle_new_user (owned by the users-role-lockdown migration)', () => {
    expect(code).not.toMatch(/on public\.users\b/);
    expect(code).not.toContain('handle_new_user');
    expect(code).not.toContain('sync_user_roles');
  });

  it('ends with an admin verification block', () => {
    expect(sql).toContain('HOW TO VERIFY AFTER RUNNING');
    expect(sql).toContain('from pg_policies');
  });
});

describe('issue 1 — drivers table', () => {
  it('drops the public read policy and replaces it with own-row only', () => {
    expect(code).toContain('drop policy if exists "Anyone can read drivers" on public.drivers;');
    const own = policyBlock('Driver can read own row');
    expect(own).toContain('for select');
    expect(own).toContain('to authenticated');
    expect(own).toContain('using (auth.uid() = "userId")');
  });

  it('leaves the verification-v2 update policy and protection triggers alone', () => {
    expect(code).not.toContain('drop policy if exists "Driver can update own row"');
    expect(code).not.toContain('drop policy if exists "Allow driver insert"');
    expect(code).not.toContain('trg_protect_driver_verification_columns on');
    expect(code).not.toContain('protect_driver_verification_columns()');
    expect(code).not.toContain('enforce_driver_verified_before_online()');
  });

  it('nearby drivers: online VERIFIED drivers only, public columns only, no phone', () => {
    const block = fnBlock('get_nearby_drivers');
    expect(block).toContain('security definer');
    expect(block).toContain(`d."isOnline" = true`);
    expect(block).toContain(`d."verificationStatus" = 'VERIFIED'`);
    const cols = returnedColumns('get_nearby_drivers');
    expect(cols).toEqual(expect.arrayContaining(['id', 'name', 'profileImage', 'rating', 'location', 'vehicle']));
    for (const priv of PRIVATE_DRIVER_COLUMNS) expect(cols, priv).not.toContain(priv);
    expect(block).toContain('public.driver_public_vehicle(m."vehicle")');
  });

  it('vehicle jsonb is rebuilt from an allow-list of keys', () => {
    const block = fnBlock('driver_public_vehicle');
    expect(block).toContain('jsonb_build_object(');
    expect(block).not.toMatch(/vin|engine/i);
  });

  it("assigned driver: only for the caller's own ride; phone + location only while active", () => {
    const block = fnBlock('get_ride_driver');
    expect(block).toContain('security definer');
    expect(block).toContain('r."userId" = auth.uid()');
    expect(block).toContain(`case when r."status" in ('accepted', 'in-progress') then d."phone" end`);
    expect(block).toContain(`case when r."status" in ('accepted', 'in-progress') then d."location" end`);
    const cols = returnedColumns('get_ride_driver');
    for (const priv of PRIVATE_DRIVER_COLUMNS.filter((c) => c !== 'phone')) expect(cols, priv).not.toContain(priv);
  });
});

describe('issue 2 — pending rides', () => {
  it('drops the open pending-rides read and the open accept policy', () => {
    expect(code).toContain('drop policy if exists "Drivers can read pending rides" on public.rides;');
    expect(code).toContain('drop policy if exists "Drivers can accept pending rides" on public.rides;');
    expect(code).not.toContain('create policy "Drivers can read pending rides"');
    expect(code).not.toContain('create policy "Drivers can accept pending rides"');
  });

  it('pending list: VERIFIED drivers only, no passenger/rider identity or contact', () => {
    const block = fnBlock('get_pending_rides_for_driver');
    expect(block).toContain('security definer');
    expect(block).toContain('me."userId" = auth.uid()');
    expect(block).toContain(`me."verificationStatus" = 'VERIFIED'`);
    expect(block).toContain(`r."status" = 'pending'`);
    expect(block).toContain('r."driverId" is null');
    expect(block).toContain('public.ride_declines');
    const cols = returnedColumns('get_pending_rides_for_driver');
    for (const priv of ['userId', 'passengerName', 'passengerPhone', 'riderName', 'riderPhone', 'riderPhoto', 'phoneNumber', 'displayName']) {
      expect(cols, priv).not.toContain(priv);
    }
    expect(block).not.toMatch(/passengerName|passengerPhone|phoneNumber|displayName|photoURL/);
  });

  it('accept_ride: verified caller, atomic claim of a still-pending unassigned ride', () => {
    const block = fnBlock('accept_ride');
    expect(block).toContain('security definer');
    expect(block).toContain(`if v_status is distinct from 'VERIFIED' then`);
    expect(block).toMatch(/where r\."id" = p_ride_id\s+and r\."status" = 'pending'\s+and r\."driverId" is null;/);
    expect(block).toContain('if not found then');
    expect(block).toContain('RIDE_NOT_AVAILABLE');
    expect(block).toContain('public.get_ride_rider_for_driver(p_ride_id)');
  });

  it('rider details: only the assigned driver, phones only while active', () => {
    const block = fnBlock('get_ride_rider_for_driver');
    expect(block).toContain('join public.drivers me on me."id" = r."driverId"');
    expect(block).toContain('me."userId" = auth.uid()');
    expect(block).toContain(`case when r."status" in ('accepted', 'in-progress') then u."phoneNumber" end`);
    expect(block).toContain(`case when r."status" in ('accepted', 'in-progress') then r."passengerPhone" end`);
  });

  it('realtime signal table: rideId only, readable by VERIFIED drivers, written by trigger only', () => {
    const table = code.slice(code.indexOf('create table if not exists public.pending_ride_signals'));
    const cols = table.slice(0, table.indexOf(');'));
    expect(cols).not.toMatch(/address|fare|passenger|phone|userId/i);
    expect(code).toContain('alter table public.pending_ride_signals enable row level security;');
    expect(policyBlock('Verified drivers can read pending ride signals')).toContain(`d."verificationStatus" = 'VERIFIED'`);
    expect(code).not.toMatch(/create policy "[^"]+"\s+on public\.pending_ride_signals for (insert|update|delete|all)/);
    expect(code).toContain('alter publication supabase_realtime add table public.pending_ride_signals;');
  });
});

describe('issue 3 — messaging', () => {
  it('conversations can only be created by a participant, tied to their shared ride', () => {
    const p = policyBlock('Participants can insert conversations');
    expect(p).toContain('auth.uid() = conversations."userId"');
    expect(p).toContain('d."userId" = auth.uid()');
    expect(p).toContain('conversations."rideId" is not null');
    expect(p).toContain('r."userId" = conversations."userId"');
    expect(p).toContain('r."driverId" = conversations."driverId"');
  });

  it('conversation identity columns are immutable from client sessions', () => {
    expect(policyBlock('Participants can update conversations')).toContain('with check');
    const block = fnBlock('conversations_protect_identity_columns');
    for (const col of ['id', 'userId', 'driverId', 'rideId']) {
      expect(block).toContain(`NEW."${col}" is distinct from OLD."${col}"`);
    }
  });

  it('messages are sent only by a participant, as themselves, unread', () => {
    const p = policyBlock('Participants can send messages');
    expect(p).toContain(`messages."senderType" = 'user'`);
    expect(p).toContain('messages."senderId" = auth.uid()');
    expect(p).toContain('c."userId" = auth.uid()');
    expect(p).toContain(`messages."senderType" = 'driver'`);
    expect(p).toContain('messages."senderId" in (d."id", d."userId")');
    expect(p).toContain('coalesce(messages."read", false) = false');
  });

  it('messages can only be updated by the recipient, and only the read flag, never back to unread', () => {
    expect(code).toContain('drop policy if exists "Participants can update messages" on public.messages;');
    const p = policyBlock('Recipient can mark messages read');
    expect(p).toContain(`(messages."senderType" = 'driver' and c."userId" = auth.uid())`);
    expect(p).toContain(`messages."senderType" = 'user'`);
    const block = fnBlock('messages_restrict_update');
    expect(block).toContain(`(to_jsonb(NEW) - 'read') is distinct from (to_jsonb(OLD) - 'read')`);
    expect(block).toContain('cannot be marked unread');
  });

  it('there is still no delete policy on messages', () => {
    expect(code).not.toMatch(/on public\.messages for delete/);
  });
});

describe('client no longer relies on the closed paths', () => {
  const driverService = read('lib/firebase-driver-service.ts');
  const rideStore = read('hooks/useRideStore.ts');
  const rideProgress = read('app/ride-progress.tsx');
  const matching = read('lib/ride-matching-service.ts');

  it('nearby drivers, pending rides and accept go through the RPCs', () => {
    expect(driverService).toContain("rpc('get_nearby_drivers'");
    expect(driverService).toContain("rpc('get_pending_rides_for_driver'");
    expect(driverService).toContain("rpc('accept_ride'");
    expect(driverService).not.toContain("users:userId(displayName, phoneNumber");
    expect(driverService).not.toMatch(/table: 'rides', filter: 'status=eq\.pending'/);
    expect(driverService).toContain("table: 'pending_ride_signals'");
  });

  it('rider side reads the assigned driver via get_ride_driver, not the drivers table', () => {
    expect(rideProgress).toContain('FirebaseDriverService.getRideDriver(currentRideId)');
    expect(rideProgress).not.toContain('FirebaseDriverService.getDriver(');
    expect(rideProgress).not.toContain('subscribeToDriverLocation(');
    expect(matching).not.toMatch(/table: 'drivers'/);
    expect(matching).not.toMatch(/eq\('status', 'pending'\)/);
  });

  it('surge counts come from the aggregate RPC', () => {
    expect(rideStore).toContain("rpc('get_marketplace_demand_counts'");
    expect(rideStore).not.toMatch(/from\('drivers'\)/);
    expect(rideStore).not.toMatch(/from\('rides'\)\.select\('id', \{ count/);
  });
});
