import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Source guards for the direct-write audit fixes (supabase/migrations/20261008001300_harden_direct_writes.sql).
// The real checks are the pgTAP tests in supabase/tests/database/direct_writes.test.sql, which run each
// attack against a real database; these only make sure the fix, and the app changes that go with it, stay.
const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');
const sql = read('supabase/migrations/20261008001300_harden_direct_writes.sql').replace(/--[^\n]*/g, '');

describe('direct-write hardening migration', () => {
  it('only affects direct app writes, never the backend or trusted database functions', () => {
    expect(sql).toContain("select current_user in ('authenticated', 'anon')");
    for (const fn of [
      'rides_protect_definition_columns',
      'drivers_protect_reputation_columns',
      'users_protect_reputation_columns',
      'driver_online_sessions_server_clock',
    ]) {
      const body = sql.slice(sql.indexOf(`function public.${fn}()`));
      expect(body.slice(0, 400), fn).toContain('if not public.is_client_session() then');
    }
  });

  it('a booked ride keeps its route, class, priority, payment method and passenger', () => {
    for (const col of ['dropoffLocation', 'pickupLocation', 'rideType', 'isPriority', 'paymentMethod', 'promoCode']) {
      expect(sql).toContain(`NEW."${col}" is distinct from OLD."${col}"`);
    }
  });

  it('arrival, start and completion times are the database clock, set once', () => {
    expect(sql).toMatch(/NEW\."arrivedAt" := now\(\)/);
    expect(sql).toMatch(/NEW\."driverId" := OLD\."driverId"/);
    expect(sql).toMatch(/NEW\."acceptedAt" := OLD\."acceptedAt"/);
    // the rating a rider gave the driver is written only by submit_rating
    expect(sql).toMatch(/NEW\."driverRating" := OLD\."driverRating"/);
  });

  it('promo usage is read-only for users and increment_promo_use is closed to the apps', () => {
    expect(sql).toContain('revoke insert, update, delete on table public.user_promo_uses from anon, authenticated;');
    expect(sql).toContain('revoke execute on function public.increment_promo_use(uuid) from public, anon, authenticated;');
    expect(sql).not.toMatch(/create policy "user_promo_uses[^"]*"\s+on public\.user_promo_uses for (all|insert|update|delete)/i);
  });

  it('ratings must come from the rider of a completed ride, for that ride\'s driver', () => {
    expect(sql).toContain('r."userId" = auth.uid()');
    expect(sql).toContain(`r."status" = 'completed'`);
    expect(sql).toContain('Not signed in');
  });

  it('a settled ride\'s status can never change, and points are never returned for a completed ride', () => {
    expect(sql).toContain('if NEW."status" is distinct from OLD."status" then');
    expect(sql).not.toContain('it cannot be settled again');
    expect(sql).toContain(`and OLD."status" is distinct from 'completed'`);
  });
});

describe('app changes that go with it', () => {
  it('the phone no longer writes promo usage (the server does, and it was being counted twice)', () => {
    const store = read('hooks/usePromotionsStore.ts');
    expect(store).not.toContain("from('user_promo_uses')\n        .insert");
    expect(store).not.toContain('increment_promo_use');
  });

  it('the server still records promo usage when a ride is created', () => {
    const create = read('backend/trpc/routes/rides/create/route.ts');
    expect(create).toContain('user_promo_uses');
    expect(create).toContain('increment_promo_use');
  });
});
