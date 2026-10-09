import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Source guards for the ride status state machine (supabase/migrations/20261008001400_ride_status_machine.sql)
// and the payment-confirmation check that goes with it. The real checks are the pgTAP tests in
// supabase/tests/database/status_machine.test.sql, which run each transition against a real database.
const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');
const sql = read('supabase/migrations/20261008001400_ride_status_machine.sql').replace(/--[^\n]*/g, '');
const confirmPayment = read('backend/trpc/routes/rides/confirm-payment/route.ts');

describe('ride status machine migration', () => {
  it('fires before the other ride triggers, so they see the corrected status', () => {
    expect(sql).toContain('create trigger rides_00_enforce_status_machine');
    expect(sql).toMatch(/before update on public\.rides/);
  });

  it('lists exactly the moves a phone may make, each tied to who may make it', () => {
    expect(sql).toContain(`when OLD."status" = 'pending'     and NEW."status" = 'cancelled'   then v_is_rider`);
    expect(sql).toContain(`when OLD."status" = 'accepted'    and NEW."status" = 'in-progress' then v_is_driver`);
    expect(sql).toContain(`when OLD."status" = 'accepted'    and NEW."status" = 'cancelled'   then v_is_rider or v_is_driver`);
    expect(sql).toContain(`when OLD."status" = 'in-progress' and NEW."status" = 'completed'   then v_is_driver`);
    // once the trip has started only the driver can end it early
    expect(sql).toContain(`when OLD."status" = 'in-progress' and NEW."status" = 'cancelled'   then v_is_driver`);
    expect(sql).toContain('else false');
  });

  it('a move that is not allowed is corrected, not rejected, so existing app builds keep working', () => {
    expect(sql).toContain('NEW."status" := OLD."status";');
  });

  it('completing needs in-progress and confirming payment needs the trip in progress, for every session', () => {
    expect(sql).toMatch(/NEW\."status" = 'completed' and OLD\."status" is distinct from 'in-progress'/);
    expect(sql).toMatch(/NEW\."paymentStatus" = 'paid'[\s\S]*OLD\."status" is distinct from 'in-progress'/);
    expect(sql).toContain('raise exception');
  });

  it('every cancellation records the state at that moment, and the apps cannot write the log', () => {
    expect(sql).toContain('NEW."cancelledFromStatus" := OLD."status"');
    expect(sql).toContain('NEW."cancelledAfterArrival" := (OLD."arrivedAt" is not null)');
    expect(sql).toContain('NEW."cancelledFromStatus" := OLD."cancelledFromStatus"');
  });
});

describe('payment confirmation', () => {
  it('requires the trip to be in progress before touching the wallet', () => {
    const guard = confirmPayment.indexOf('ride.status !== "in-progress"');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(confirmPayment.indexOf('db.rpc("add_wallet_transaction"'));
    expect(guard).toBeLessThan(confirmPayment.indexOf('.update({ paymentStatus: "paid" })'));
  });
});

describe('self-rides', () => {
  const selfRides = read('supabase/migrations/20261008001500_no_self_rides.sql').replace(/--[^\n]*/g, '');

  it('a driver cannot accept a ride booked by their own account', () => {
    const accept = selfRides.slice(selfRides.indexOf('function public.accept_ride'), selfRides.indexOf('function public.get_pending_rides_for_driver'));
    expect(accept).toContain(`and r."userId" is distinct from auth.uid();`);
    expect(accept).toContain('RIDE_NOT_AVAILABLE');
  });

  it('a driver is not offered their own request', () => {
    const pending = selfRides.slice(selfRides.indexOf('function public.get_pending_rides_for_driver'));
    expect(pending).toContain(`and r."userId" is distinct from auth.uid()`);
  });
});

describe('rider cancelling mid-trip', () => {
  it('the rider app does not offer the cancel button once the trip has started', () => {
    const screen = read('app/ride-progress.tsx');
    expect(screen).toMatch(/stage !== 'trip_in_progress' \? \(\s*<Pressable style=\{styles\.secondaryButton\} onPress=\{handleCancelRide\}/);
  });
});
