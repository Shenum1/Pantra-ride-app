import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Source guards on how points are wired into booking, payment, refunds and the
// driver screen. The money rules themselves are tested against a real database
// in supabase/tests/database/points.test.sql and in points-cover.test.ts.
const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');
const createRoute = read('backend/trpc/routes/rides/create/route.ts');
const confirmPayment = read('backend/trpc/routes/rides/confirm-payment/route.ts');
const refundProcessor = read('backend/lib/refund-processor.ts');
const sql = read('supabase/migrations/20261008001000_points_pay_rides.sql').replace(/--[^\n]*/g, '');

describe('rides.create with points', () => {
  it('only accepts a yes/no from the client, never an amount', () => {
    expect(createRoute).toContain('usePoints: z.boolean().default(false)');
    expect(createRoute).not.toMatch(/pointsUsed:\s*z\./);
    expect(createRoute).not.toMatch(/pointsValueNGN:\s*z\./);
  });

  it('works out the cover on the server from the database balance, with the shared rule', () => {
    expect(createRoute).toContain('calculatePointsCover(fare, balance)');
    expect(createRoute).toContain('db.rpc("points_balance", { p_user_id: ctx.userId })');
  });

  it('a failed return of reserved points is logged, not swallowed', () => {
    expect(createRoute).toContain('const { error: returnError } = await db.rpc("refund_ride_points"');
    expect(createRoute).toContain('could NOT be returned');
  });

  it('reserves the points before creating the ride, and gives them back if the ride is not created', () => {
    expect(createRoute.indexOf('reserve_ride_points')).toBeLessThan(createRoute.indexOf('db.from("rides").insert'));
    expect(createRoute).toMatch(/if \(error\) \{[\s\S]*refund_ride_points[\s\S]*throw new Error\(error\.message\)/);
  });

  it('stores the points on the ride using the id it reserved them under', () => {
    expect(createRoute).toContain('id: rideId');
    expect(createRoute).toMatch(/pointsUsed,\s*pointsValueNGN,/);
  });
});

describe('paying for the rest of the fare', () => {
  it('the wallet is debited fare minus the points part, never below zero', () => {
    expect(confirmPayment).toContain('pointsValueNGN');
    expect(confirmPayment).toContain(
      'p_amount: -Math.max(0, Math.round(((ride.fare ?? 0) - (ride.pointsValueNGN ?? 0)) * 100) / 100),'
    );
  });
});

describe('points migration', () => {
  it('locks the points columns on rides against app sessions', () => {
    expect(sql).toContain('create trigger rides_protect_points_columns');
    expect(sql).toMatch(/if auth\.role\(\) = 'service_role' then\s+return NEW;/);
  });

  it('only the backend can reserve or return points', () => {
    expect(sql).toContain('grant execute on function public.reserve_ride_points(text, uuid, integer) to service_role;');
    expect(sql).toContain('grant execute on function public.refund_ride_points(uuid) to service_role;');
    expect(sql).not.toMatch(/grant [^;]*to[^;]*authenticated/i);
  });

  it('a ride is charged and refunded its points at most once', () => {
    expect(sql).toContain(`where type = 'ride_redemption'`);
    expect(sql).toContain(`where type = 'ride_refund'`);
    expect(sql).toMatch(/create unique index if not exists idx_points_one_redemption_per_ride/);
    expect(sql).toMatch(/create unique index if not exists idx_points_one_refund_per_ride/);
  });

  it('a cancelled ride returns its points automatically', () => {
    expect(sql).toContain('create trigger rides_return_points_on_cancel');
    expect(sql).toMatch(/after update of status on public\.rides/);
  });

  it('a cash ride credits the driver the points part, once', () => {
    expect(sql).toContain(`'points_credit'`);
    expect(sql).toContain(`create unique index if not exists idx_driver_commission_ledger_ride_points_credit`);
    expect(sql).toMatch(/pointsValueNGN/);
  });
});

describe('refunds and the driver app', () => {
  it('a refund returns points in proportion to the cumulative refund, decided in the database', () => {
    expect(refundProcessor).toContain('rpc("refund_ride_points"');
    expect(refundProcessor).toContain('p_refunded:');
    expect(refundProcessor).toContain('p_original:');
    expect(refundProcessor).toContain('.eq("status", "completed")');
  });

  it('returned points keep their original expiry, with a 7-day minimum', () => {
    const returnRules = read('supabase/migrations/20261008001200_points_return_rules.sql');
    expect(returnRules).toContain("greatest(p.piece_expiry, now() + interval '7 days')");
    expect(returnRules).toContain('floor(v_points * v_fraction)');
  });

  it('the driver can retry the cash amount by hand once the first attempts have failed', () => {
    const screen = read('app/driver-active-trip.tsx');
    expect(screen).toContain('driver-points-retry');
    expect(screen).toContain('pointsLookupFailed');
    expect(read('hooks/useDriverStore.ts')).toContain('setPointsLookupFailed(pointsValueNGN === null)');
  });

  it('the driver sees only the cash they collect on a cash ride', () => {
    const screen = read('app/driver-active-trip.tsx');
    expect(screen).toContain("currentRide.paysWith === 'cash'");
    expect(screen).toContain('Collect cash');
  });

  it('the driver app never guesses the points part: an unreadable value is "unknown", not 0', () => {
    const service = read('lib/firebase-driver-service.ts');
    expect(service).toContain('static async getRidePointsValue(rideId: string): Promise<number | null>');
    expect(service).toContain('return null;');
    expect(service).not.toMatch(/getRidePointsValue[\s\S]{0,600}return 0;/);
    const screen = read('app/driver-active-trip.tsx');
    expect(screen).toContain('Checking…');
  });

  it('the wallet debit is rounded to kobo', () => {
    expect(confirmPayment).toContain('Math.round(((ride.fare ?? 0) - (ride.pointsValueNGN ?? 0)) * 100) / 100');
  });

  it('the old client-side points spending is gone', () => {
    expect(fs.existsSync(path.resolve(process.cwd(), 'app/ride-checkout.tsx'))).toBe(false);
    expect(read('lib/rewards-service.ts')).not.toContain('redeemPoints');
    expect(read('hooks/usePointsStore.ts')).not.toContain('redeemForRide');
  });
});
