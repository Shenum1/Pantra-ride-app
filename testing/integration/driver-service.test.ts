import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({}),
  doc: vi.fn().mockReturnValue({}),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockReturnValue({}),
  where: vi.fn().mockReturnValue({}),
  orderBy: vi.fn().mockReturnValue({}),
  limit: vi.fn().mockReturnValue({}),
  onSnapshot: vi.fn().mockReturnValue(() => {}),
  serverTimestamp: vi.fn(() => new Date()),
}));

import * as firestore from 'firebase/firestore';
import { FirebaseDriverService } from '@/lib/firebase-driver-service';

describe('WAT Agent 1 — Driver Service (TC-3.1 / TC-3.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Pure function: distance ───────────────────────────────────────────
  describe('calculateDistance — pure utility', () => {
    it('TC-3.P1 PASS — identical points return 0', () => {
      expect(FirebaseDriverService.calculateDistance(9.0765, 7.3986, 9.0765, 7.3986)).toBe(0);
    });

    it('TC-3.P2 PASS — long distance is correctly estimated', () => {
      const dist = FirebaseDriverService.calculateDistance(9.0765, 7.3986, 6.5244, 3.3792);
      expect(dist).toBeGreaterThan(400);
      expect(dist).toBeLessThan(700);
    });
  });

  // ── TC-3.2 Online/Offline toggle ──────────────────────────────────────
  describe('setDriverOnlineStatus', () => {
    it('TC-3.2.1 PASS — sets driver online', async () => {
      vi.mocked(firestore.updateDoc).mockResolvedValue(undefined);

      await FirebaseDriverService.setDriverOnlineStatus('drv-001', true);

      expect(firestore.updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isOnline: true }),
      );
    });

    it('TC-3.2.2 PASS — sets driver offline', async () => {
      vi.mocked(firestore.updateDoc).mockResolvedValue(undefined);

      await FirebaseDriverService.setDriverOnlineStatus('drv-001', false);

      expect(firestore.updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isOnline: false }),
      );
    });

    it('TC-3.2.3 PASS — throws on Firestore error', async () => {
      vi.mocked(firestore.updateDoc).mockRejectedValue(new Error('Permission denied'));

      await expect(
        FirebaseDriverService.setDriverOnlineStatus('drv-001', true),
      ).rejects.toThrow('Permission denied');
    });
  });

  // ── TC-3.2 Accept ride ────────────────────────────────────────────────
  describe('acceptRide', () => {
    it('TC-3.2.4 PASS — updates ride with driverId and status=accepted', async () => {
      vi.mocked(firestore.updateDoc).mockResolvedValue(undefined);

      await FirebaseDriverService.acceptRide('ride-001', 'drv-001');

      expect(firestore.updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ driverId: 'drv-001', status: 'accepted' }),
      );
    });

    it('TC-3.2.5 PASS — throws on Firestore error', async () => {
      vi.mocked(firestore.updateDoc).mockRejectedValue(new Error('Write failed'));

      await expect(
        FirebaseDriverService.acceptRide('ride-001', 'drv-001'),
      ).rejects.toThrow('Write failed');
    });
  });

  // ── BUG-F-001: declineRide not implemented ────────────────────────────
  describe('declineRide', () => {
    it('TC-3.2.6 DOCUMENT BUG — declineRide is a no-op (not implemented)', async () => {
      // This test documents BUG-F-001: declineRide only logs, no DB write.
      // When a driver declines, the ride should be returned to the pool —
      // instead nothing happens and the ride stays in 'pending'.
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await FirebaseDriverService.declineRide('ride-001');

      expect(firestore.updateDoc).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ── TC-3.2 Ride status transitions ───────────────────────────────────
  describe('updateRideStatus', () => {
    it('TC-3.2.7 PASS — in_progress adds startedAt timestamp', async () => {
      vi.mocked(firestore.updateDoc).mockResolvedValue(undefined);

      await FirebaseDriverService.updateRideStatus('ride-001', 'in_progress', 'drv-001');

      expect(firestore.updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ startedAt: expect.anything() }),
      );
    });

    it('TC-3.2.8 PASS — completed adds completedAt and sets driver back online', async () => {
      vi.mocked(firestore.updateDoc).mockResolvedValue(undefined);

      await FirebaseDriverService.updateRideStatus('ride-001', 'completed', 'drv-001');

      const calls = vi.mocked(firestore.updateDoc).mock.calls;
      const statusCall = calls.find((c) => (c[1] as any).completedAt);
      expect(statusCall).toBeDefined();
      // Driver re-enabled (isOnline: true)
      const driverCall = calls.find((c) => (c[1] as any).isOnline === true);
      expect(driverCall).toBeDefined();
    });

    it('TC-3.2.9 PASS — cancelled adds cancelledAt timestamp', async () => {
      vi.mocked(firestore.updateDoc).mockResolvedValue(undefined);

      await FirebaseDriverService.updateRideStatus('ride-001', 'cancelled', 'drv-001');

      expect(firestore.updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ cancelledAt: expect.anything() }),
      );
    });
  });

  // ── TC-3.3 Driver location ────────────────────────────────────────────
  describe('updateDriverLocation', () => {
    it('TC-3.3.1 PASS — saves latitude and longitude', async () => {
      vi.mocked(firestore.updateDoc).mockResolvedValue(undefined);

      await FirebaseDriverService.updateDriverLocation('drv-001', 9.0765, 7.3986);

      expect(firestore.updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          location: { latitude: 9.0765, longitude: 7.3986 },
        }),
      );
    });
  });

  // ── TC-3.3 Earnings ───────────────────────────────────────────────────
  describe('getDriverEarnings', () => {
    it('TC-3.3.2 PASS — calculates net earnings as 80% of fare', async () => {
      const mockSnapshot = {
        forEach: (fn: (doc: any) => void) => {
          fn({
            id: 'ride-complete-1',
            data: () => ({ fare: 100, completedAt: { toDate: () => new Date() } }),
          });
        },
      };
      vi.mocked(firestore.getDocs).mockResolvedValue(mockSnapshot as any);

      const earnings = await FirebaseDriverService.getDriverEarnings('drv-001');

      expect(earnings).toHaveLength(1);
      expect(earnings[0].amount).toBe(100);
      expect(earnings[0].commission).toBe(20);    // 20%
      expect(earnings[0].netAmount).toBe(80);     // 80%
    });

    it('TC-3.3.3 PASS — returns empty array when no completed rides', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue({
        forEach: () => {},
      } as any);

      const earnings = await FirebaseDriverService.getDriverEarnings('drv-new');

      expect(earnings).toHaveLength(0);
    });
  });

  // ── TC-3.3 Driver stats ───────────────────────────────────────────────
  describe('getDriverStats', () => {
    it('TC-3.3.4 PASS — aggregates total rides and earnings correctly', async () => {
      const mockSnapshot = {
        forEach: (fn: (doc: any) => void) => {
          [
            { fare: 50, driverRating: 5 },
            { fare: 80, driverRating: 4 },
          ].forEach((data) =>
            fn({ id: `ride-${Math.random()}`, data: () => ({ ...data, completedAt: { toDate: () => new Date() } }) }),
          );
        },
      };
      vi.mocked(firestore.getDocs).mockResolvedValue(mockSnapshot as any);

      const stats = await FirebaseDriverService.getDriverStats('drv-001');

      expect(stats.totalRides).toBe(2);
      expect(stats.totalEarnings).toBeCloseTo((50 + 80) * 0.8, 1);
    });

    it('TC-3.3.5 PASS — new driver with no rides returns safe defaults', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue({
        forEach: () => {},
      } as any);

      const stats = await FirebaseDriverService.getDriverStats('drv-new');

      expect(stats.totalRides).toBe(0);
      expect(stats.averageRating).toBe(5.0);
    });
  });

  // ── TC-3.4 Edge cases ─────────────────────────────────────────────────
  describe('subscribeToRideRequests — edge cases', () => {
    it('TC-3.4.1 PASS — returns unsubscribe function', () => {
      const mockUnsub = vi.fn();
      vi.mocked(firestore.onSnapshot).mockReturnValue(mockUnsub);

      const unsub = FirebaseDriverService.subscribeToRideRequests('drv-001', vi.fn());

      expect(typeof unsub).toBe('function');
    });
  });
});
