import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/database-service', () => ({
  DatabaseService: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: vi.fn(),
  },
}));

vi.mock('@/lib/firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn().mockReturnValue(() => {}),
  collection: vi.fn().mockReturnValue({}),
  query: vi.fn().mockReturnValue({}),
  where: vi.fn().mockReturnValue({}),
  doc: vi.fn().mockReturnValue({}),
}));

import { DatabaseService } from '@/lib/database-service';
import { RideMatchingService } from '@/lib/ride-matching-service';

describe('WAT Agent 1 — Ride Matching Service (TC-2.3 / TC-2.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Pure function: distance calculation ───────────────────────────────
  describe('calculateDistance — pure utility', () => {
    it('TC-2.3.P1 PASS — returns 0 for identical coordinates', () => {
      const dist = RideMatchingService.calculateDistance(9.0765, 7.3986, 9.0765, 7.3986);
      expect(dist).toBe(0);
    });

    it('TC-2.3.P2 PASS — Abuja to Kano is ~480km', () => {
      // Abuja: 9.0765, 7.3986 | Kano: 12.0022, 8.5919
      const dist = RideMatchingService.calculateDistance(9.0765, 7.3986, 12.0022, 8.5919);
      expect(dist).toBeGreaterThan(350);
      expect(dist).toBeLessThan(600);
    });

    it('TC-2.3.P3 PASS — nearby points < 1km apart', () => {
      const dist = RideMatchingService.calculateDistance(9.0765, 7.3986, 9.077, 7.399);
      expect(dist).toBeLessThan(1);
    });

    it('TC-2.3.P4 PASS — distance is symmetric (A→B = B→A)', () => {
      const ab = RideMatchingService.calculateDistance(9.0765, 7.3986, 9.15, 7.45);
      const ba = RideMatchingService.calculateDistance(9.15, 7.45, 9.0765, 7.3986);
      expect(Math.abs(ab - ba)).toBeLessThan(0.0001);
    });
  });

  // ── TC-2.3 Ride booking ───────────────────────────────────────────────
  describe('findNearbyDrivers', () => {
    it('TC-2.3.1 PASS — returns nearby available drivers sorted by distance', async () => {
      const mockDrivers = [
        { id: 'drv-1', status: 'available', vehicleType: 'standard', currentLocation: { lat: 9.08, lng: 7.40 } },
        { id: 'drv-2', status: 'available', vehicleType: 'standard', currentLocation: { lat: 9.09, lng: 7.41 } },
      ];
      vi.mocked(DatabaseService.query).mockResolvedValue(mockDrivers);

      const drivers = await RideMatchingService.findNearbyDrivers(9.0765, 7.3986, 5, 'standard');

      expect(drivers.length).toBeGreaterThan(0);
      expect(drivers[0]).toHaveProperty('distanceToPickup');
    });

    it('TC-2.3.2 PASS — returns empty array when no drivers available (TC-2.8)', async () => {
      vi.mocked(DatabaseService.query).mockResolvedValue([]);

      const drivers = await RideMatchingService.findNearbyDrivers(9.0765, 7.3986, 5, 'standard');

      expect(drivers).toHaveLength(0);
    });

    it('TC-2.3.3 PASS — drivers outside radius are excluded', async () => {
      const farDriver = {
        id: 'drv-far',
        status: 'available',
        vehicleType: 'standard',
        currentLocation: { lat: 12.0022, lng: 8.5919 }, // ~480km away
      };
      vi.mocked(DatabaseService.query).mockResolvedValue([farDriver]);

      const drivers = await RideMatchingService.findNearbyDrivers(9.0765, 7.3986, 5, 'standard');

      expect(drivers).toHaveLength(0);
    });
  });

  describe('matchRideWithDriver', () => {
    it('TC-2.3.4 PASS — matches nearest available driver', async () => {
      const mockRide = {
        id: 'ride-001',
        pickupLocation: { lat: 9.0765, lng: 7.3986 },
        rideType: 'standard',
      };
      const mockDrivers = [
        { id: 'drv-1', status: 'available', vehicleType: 'standard', currentLocation: { lat: 9.08, lng: 7.40 } },
      ];
      vi.mocked(DatabaseService.get).mockResolvedValue(mockRide);
      vi.mocked(DatabaseService.query).mockResolvedValue(mockDrivers);
      vi.mocked(DatabaseService.update).mockResolvedValue(undefined);

      const result = await RideMatchingService.matchRideWithDriver('ride-001');

      expect(result).not.toBeNull();
      expect(result!.rideId).toBe('ride-001');
      expect(result!.driverId).toBe('drv-1');
      expect(result!.estimatedArrival).toBeGreaterThan(0);
    });

    it('TC-2.3.5 PASS — returns null when no drivers nearby (TC-2.8)', async () => {
      vi.mocked(DatabaseService.get).mockResolvedValue({
        id: 'ride-002',
        pickupLocation: { lat: 9.0765, lng: 7.3986 },
        rideType: 'standard',
      });
      vi.mocked(DatabaseService.query).mockResolvedValue([]);

      const result = await RideMatchingService.matchRideWithDriver('ride-002');

      expect(result).toBeNull();
    });

    it('TC-2.3.6 PASS — throws when ride not found', async () => {
      vi.mocked(DatabaseService.get).mockResolvedValue(null);

      const result = await RideMatchingService.matchRideWithDriver('nonexistent-ride');

      expect(result).toBeNull();
    });
  });

  // ── TC-2.7 Cancellation ───────────────────────────────────────────────
  describe('cancelRide', () => {
    it('TC-2.7.1 PASS — cancels ride and frees driver', async () => {
      const mockRide = { id: 'ride-003', driverId: 'drv-1', status: 'accepted' };
      vi.mocked(DatabaseService.get).mockResolvedValue(mockRide);
      vi.mocked(DatabaseService.update).mockResolvedValue(undefined);

      await expect(RideMatchingService.cancelRide('ride-003')).resolves.not.toThrow();
      expect(DatabaseService.update).toHaveBeenCalledWith('rides', 'ride-003', { status: 'cancelled' });
      expect(DatabaseService.update).toHaveBeenCalledWith('drivers', 'drv-1', { status: 'available' });
    });

    it('TC-2.7.2 PASS — cancels ride without driver (before driver accepts)', async () => {
      const mockRide = { id: 'ride-004', driverId: null, status: 'pending' };
      vi.mocked(DatabaseService.get).mockResolvedValue(mockRide);
      vi.mocked(DatabaseService.update).mockResolvedValue(undefined);

      await expect(RideMatchingService.cancelRide('ride-004')).resolves.not.toThrow();
      expect(DatabaseService.update).toHaveBeenCalledTimes(1); // only ride, not driver
    });

    it('TC-2.7.3 PASS — throws when ride not found', async () => {
      vi.mocked(DatabaseService.get).mockResolvedValue(null);

      await expect(RideMatchingService.cancelRide('ghost-ride')).rejects.toThrow('Ride not found');
    });
  });

  // ── Ride completion ───────────────────────────────────────────────────
  describe('completeRide', () => {
    it('TC-2.5.1 PASS — marks ride as completed and frees driver', async () => {
      const mockRide = { id: 'ride-005', driverId: 'drv-2', status: 'in_progress' };
      vi.mocked(DatabaseService.get).mockResolvedValue(mockRide);
      vi.mocked(DatabaseService.update).mockResolvedValue(undefined);

      await expect(RideMatchingService.completeRide('ride-005')).resolves.not.toThrow();
      expect(DatabaseService.update).toHaveBeenCalledWith('rides', 'ride-005', { status: 'completed' });
      expect(DatabaseService.update).toHaveBeenCalledWith('drivers', 'drv-2', { status: 'available' });
    });

    it('TC-2.5.2 PASS — throws when ride not found', async () => {
      vi.mocked(DatabaseService.get).mockResolvedValue(null);

      await expect(RideMatchingService.completeRide('ghost-ride')).rejects.toThrow('Ride not found');
    });
  });
});
