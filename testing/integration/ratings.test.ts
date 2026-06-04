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

import { DatabaseService } from '@/lib/database-service';
import { RatingService } from '@/lib/rating-service';

describe('WAT Agent 1 — Rating Service (TC-2.6 / TC-3.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TC-2.6 Post-ride rating ───────────────────────────────────────────
  describe('submitRating', () => {
    it('TC-2.6.1 PASS — rider submits valid 5-star rating', async () => {
      vi.mocked(DatabaseService.query).mockResolvedValue([]); // no prior rating
      vi.mocked(DatabaseService.create).mockResolvedValue('rating-001');
      vi.mocked(DatabaseService.update).mockResolvedValue(undefined); // updateDriverRating

      // second query for updateDriverRating (all driver ratings)
      vi.mocked(DatabaseService.query)
        .mockResolvedValueOnce([]) // no existing rating for this ride
        .mockResolvedValueOnce([{ rating: 5 }]); // driver's full rating set

      const id = await RatingService.submitRating({
        rideId: 'ride-001',
        userId: 'user-001',
        driverId: 'drv-001',
        rating: 5,
        comment: 'Excellent driver!',
      });

      expect(id).toBe('rating-001');
      expect(DatabaseService.create).toHaveBeenCalledWith(
        'ratings',
        expect.objectContaining({ rating: 5, rideId: 'ride-001' }),
      );
    });

    it('TC-2.6.2 PASS — rider submits valid 1-star rating', async () => {
      vi.mocked(DatabaseService.query)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ rating: 1 }]);
      vi.mocked(DatabaseService.create).mockResolvedValue('rating-002');
      vi.mocked(DatabaseService.update).mockResolvedValue(undefined);

      const id = await RatingService.submitRating({
        rideId: 'ride-002',
        userId: 'user-001',
        driverId: 'drv-001',
        rating: 1,
        comment: 'Very bad experience',
      });

      expect(id).toBe('rating-002');
    });

    it('TC-2.6.3 PASS — duplicate rating for same ride is rejected', async () => {
      vi.mocked(DatabaseService.query).mockResolvedValue([
        { id: 'rating-existing', rideId: 'ride-001', userId: 'user-001' },
      ]);

      await expect(
        RatingService.submitRating({
          rideId: 'ride-001',
          userId: 'user-001',
          driverId: 'drv-001',
          rating: 4,
        }),
      ).rejects.toThrow('Rating already submitted for this ride');
    });

    it('TC-2.6.4 PASS — rating with tags submits correctly', async () => {
      vi.mocked(DatabaseService.query)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ rating: 5 }]);
      vi.mocked(DatabaseService.create).mockResolvedValue('rating-003');
      vi.mocked(DatabaseService.update).mockResolvedValue(undefined);

      const id = await RatingService.submitRating({
        rideId: 'ride-003',
        userId: 'user-001',
        driverId: 'drv-001',
        rating: 5,
        tags: ['Clean Car', 'On Time', 'Friendly'],
      });

      expect(id).toBe('rating-003');
      expect(DatabaseService.create).toHaveBeenCalledWith(
        'ratings',
        expect.objectContaining({ tags: ['Clean Car', 'On Time', 'Friendly'] }),
      );
    });
  });

  // ── Driver rating update ──────────────────────────────────────────────
  describe('updateDriverRating', () => {
    it('TC-2.6.5 PASS — average is correct for multiple ratings', async () => {
      vi.mocked(DatabaseService.query).mockResolvedValue([
        { rating: 5 },
        { rating: 4 },
        { rating: 3 },
      ]);
      vi.mocked(DatabaseService.update).mockResolvedValue(undefined);

      await RatingService.updateDriverRating('drv-001');

      expect(DatabaseService.update).toHaveBeenCalledWith(
        'drivers',
        'drv-001',
        expect.objectContaining({
          rating: 4,           // (5+4+3)/3 = 4.0, rounded to 1dp
          totalRatings: 3,
        }),
      );
    });

    it('TC-2.6.6 PASS — no update when driver has no ratings', async () => {
      vi.mocked(DatabaseService.query).mockResolvedValue([]);

      await RatingService.updateDriverRating('drv-new');

      expect(DatabaseService.update).not.toHaveBeenCalled();
    });
  });

  // ── TC-2.6 Retrieve ratings ───────────────────────────────────────────
  describe('getDriverRatings', () => {
    it('TC-2.6.7 PASS — returns all ratings for a driver', async () => {
      const mockRatings = [
        { id: 'r1', driverId: 'drv-001', rating: 5 },
        { id: 'r2', driverId: 'drv-001', rating: 4 },
      ];
      vi.mocked(DatabaseService.query).mockResolvedValue(mockRatings);

      const ratings = await RatingService.getDriverRatings('drv-001');

      expect(ratings).toHaveLength(2);
      expect(ratings[0].rating).toBe(5);
    });
  });

  describe('getRideRating', () => {
    it('TC-2.6.8 PASS — returns rating for a specific ride', async () => {
      vi.mocked(DatabaseService.query).mockResolvedValue([
        { id: 'r-001', rideId: 'ride-001', rating: 5 },
      ]);

      const rating = await RatingService.getRideRating('ride-001');

      expect(rating).not.toBeNull();
      expect(rating!.rating).toBe(5);
    });

    it('TC-2.6.9 PASS — returns null when ride has no rating yet', async () => {
      vi.mocked(DatabaseService.query).mockResolvedValue([]);

      const rating = await RatingService.getRideRating('unrated-ride');

      expect(rating).toBeNull();
    });
  });

  // ── Common tags ───────────────────────────────────────────────────────
  describe('getCommonTags', () => {
    it('TC-2.6.10 PASS — returns non-empty list of review tags', () => {
      const tags = RatingService.getCommonTags();

      expect(tags.length).toBeGreaterThan(0);
      expect(tags).toContain('Friendly');
      expect(tags).toContain('Safe Driver');
    });
  });
});
