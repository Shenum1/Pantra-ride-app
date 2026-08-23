import { beforeEach, describe, expect, it, vi } from 'vitest';

// FirebaseDriverService is Supabase-backed (the name predates the migration
// off Firebase) — mock @/lib/supabase's client, not firebase/firestore. The
// previous version of this file mocked firebase/firestore, an API surface
// the service hasn't called in a long time, so none of its assertions were
// actually exercising real code.
const fromMock = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: any[]) => fromMock(...args) },
}));

import { FirebaseDriverService } from '@/lib/firebase-driver-service';
import { PLATFORM_COMMISSION_RATE, DRIVER_PAYOUT_RATE } from '@/lib/pricing-config';

// Minimal chainable query-builder stand-in. Every one of select/eq/in/order/
// limit/is/update/upsert/insert returns `this` so calls can be chained in any
// order the real code uses; single()/maybeSingle() resolve with the
// configured result, and the builder itself is awaitable (Supabase's actual
// builders are thenables) for call sites that don't terminate with .single().
function makeBuilder(result: { data?: any; error?: any }) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    is: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (v: typeof result) => any) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

describe('FirebaseDriverService — Supabase-backed (10/90 commission)', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  describe('calculateDistance — pure utility', () => {
    it('identical points return 0', () => {
      expect(FirebaseDriverService.calculateDistance(9.0765, 7.3986, 9.0765, 7.3986)).toBe(0);
    });

    it('long distance is correctly estimated', () => {
      const dist = FirebaseDriverService.calculateDistance(9.0765, 7.3986, 6.5244, 3.3792);
      expect(dist).toBeGreaterThan(400);
      expect(dist).toBeLessThan(700);
    });
  });

  describe('setDriverOnlineStatus', () => {
    it('sets isOnline via an update on the drivers table', async () => {
      const builder = makeBuilder({ data: null, error: null });
      fromMock.mockReturnValue(builder);

      await FirebaseDriverService.setDriverOnlineStatus('drv-001', true);

      expect(fromMock).toHaveBeenCalledWith('drivers');
      expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ isOnline: true }));
      expect(builder.eq).toHaveBeenCalledWith('id', 'drv-001');
    });

    it('throws when Supabase returns an error', async () => {
      fromMock.mockReturnValue(makeBuilder({ data: null, error: { message: 'Permission denied' } }));

      await expect(FirebaseDriverService.setDriverOnlineStatus('drv-001', true)).rejects.toThrow('Permission denied');
    });
  });

  describe('acceptRide', () => {
    it('assigns driverId and sets status=accepted', async () => {
      const rideBuilder = makeBuilder({ data: null, error: null });
      const driverBuilder = makeBuilder({ data: null, error: null });
      fromMock.mockImplementation((table: string) => (table === 'rides' ? rideBuilder : driverBuilder));

      await FirebaseDriverService.acceptRide('ride-001', 'drv-001');

      expect(rideBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ driverId: 'drv-001', status: 'accepted' })
      );
    });
  });

  describe('declineRide', () => {
    it('upserts an ignore-duplicate row into ride_declines', async () => {
      const builder = makeBuilder({ data: null, error: null });
      fromMock.mockReturnValue(builder);

      await FirebaseDriverService.declineRide('ride-001', 'drv-001');

      expect(fromMock).toHaveBeenCalledWith('ride_declines');
      expect(builder.upsert).toHaveBeenCalledWith(
        { rideId: 'ride-001', driverId: 'drv-001' },
        { onConflict: 'rideId,driverId', ignoreDuplicates: true }
      );
    });
  });

  describe('updateRideStatus — completion snapshots commission at the CURRENT (10/90) rate', () => {
    it('₦5,000 fare, no flat fees → ₦500 platform commission, ₦4,500 driver earnings', async () => {
      const selectBuilder = makeBuilder({
        data: { fare: 5000, bookingFee: 0, serviceFee: 0, zoneFee: 0, waitingCharge: 0, priorityFee: 0 },
        error: null,
      });
      const updateBuilder = makeBuilder({ data: null, error: null });
      let call = 0;
      fromMock.mockImplementation((table: string) => {
        if (table !== 'rides') return makeBuilder({ data: null, error: null });
        call += 1;
        return call === 1 ? selectBuilder : updateBuilder;
      });

      await FirebaseDriverService.updateRideStatus('ride-001', 'completed', 'drv-001');

      expect(PLATFORM_COMMISSION_RATE).toBe(0.1);
      expect(DRIVER_PAYOUT_RATE).toBe(0.9);
      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          platformCommissionRate: 0.1,
          platformCommissionAmount: 500,
          driverEarningsAmount: 4500,
          completedAt: expect.anything(),
        })
      );
      // Explicitly NOT the pre-migration 20/80 split.
      const written = updateBuilder.update.mock.calls[0][0];
      expect(written.platformCommissionAmount).not.toBe(1000);
      expect(written.driverEarningsAmount).not.toBe(4000);
    });

    it('excludes flat platform fees (bookingFee/serviceFee/zoneFee/priorityFee) from the commissionable base', async () => {
      const selectBuilder = makeBuilder({
        data: { fare: 5000, bookingFee: 100, serviceFee: 50, zoneFee: 200, waitingCharge: 0, priorityFee: 150 },
        error: null,
      });
      const updateBuilder = makeBuilder({ data: null, error: null });
      let call = 0;
      fromMock.mockImplementation(() => {
        call += 1;
        return call === 1 ? selectBuilder : updateBuilder;
      });

      await FirebaseDriverService.updateRideStatus('ride-002', 'completed', 'drv-001');

      // meteredFare = 5000 - 100 - 50 - 200 - 0 - 150 = 4500; commission = 450
      const written = updateBuilder.update.mock.calls[0][0];
      expect(written.platformCommissionAmount).toBe(450);
      expect(written.driverEarningsAmount).toBe(5000 - 450);
    });

    it('cancelled adds cancelledAt and does not touch commission fields', async () => {
      const builder = makeBuilder({ data: null, error: null });
      fromMock.mockReturnValue(builder);

      await FirebaseDriverService.updateRideStatus('ride-003', 'cancelled', 'drv-001');

      expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ cancelledAt: expect.anything() }));
      const written = builder.update.mock.calls[0][0];
      expect(written.platformCommissionAmount).toBeUndefined();
    });
  });

  describe('getDriverEarnings', () => {
    it('prefers the persisted commission snapshot over a live recompute', async () => {
      fromMock.mockReturnValue(
        makeBuilder({
          data: [
            {
              id: 'ride-complete-1',
              fare: 5000,
              bookingFee: 0,
              serviceFee: 0,
              zoneFee: 0,
              waitingCharge: 0,
              priorityFee: 0,
              cancellationFee: 0,
              status: 'completed',
              completedAt: new Date().toISOString(),
              cancelledAt: null,
              createdAt: new Date().toISOString(),
              // Snapshotted at an old (pre-migration) rate — must win over a
              // live recompute at today's 10% rate.
              platformCommissionAmount: 1000,
              driverEarningsAmount: 4000,
            },
          ],
          error: null,
        })
      );

      const earnings = await FirebaseDriverService.getDriverEarnings('drv-001');

      expect(earnings).toHaveLength(1);
      expect(earnings[0].commission).toBe(1000);
      expect(earnings[0].netAmount).toBe(4000);
    });

    it('falls back to a live 10/90 recompute for legacy rows with no snapshot', async () => {
      fromMock.mockReturnValue(
        makeBuilder({
          data: [
            {
              id: 'ride-legacy-1',
              fare: 1000,
              bookingFee: 0,
              serviceFee: 0,
              zoneFee: 0,
              waitingCharge: 0,
              priorityFee: 0,
              cancellationFee: 0,
              status: 'completed',
              completedAt: new Date().toISOString(),
              cancelledAt: null,
              createdAt: new Date().toISOString(),
              platformCommissionAmount: null,
              driverEarningsAmount: null,
            },
          ],
          error: null,
        })
      );

      const earnings = await FirebaseDriverService.getDriverEarnings('drv-001');

      expect(earnings[0].commission).toBe(100);
      expect(earnings[0].netAmount).toBe(900);
    });

    it('returns an empty array when there are no completed/charged-cancelled rides', async () => {
      fromMock.mockReturnValue(makeBuilder({ data: [], error: null }));

      const earnings = await FirebaseDriverService.getDriverEarnings('drv-new');

      expect(earnings).toHaveLength(0);
    });
  });
});
