import { beforeEach, describe, expect, it, vi } from 'vitest';

function chainable(result: { data: any; error: any }) {
  const builder: any = {};
  const chainMethods = ['select', 'eq', 'order', 'limit', 'insert', 'update', 'delete'];
  chainMethods.forEach((method) => {
    builder[method] = vi.fn(() => builder);
  });
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => fromMock(...args),
    rpc: (...args: any[]) => rpcMock(...args),
  },
}));

import { RatingService } from '@/lib/rating-service';

describe('WAT Agent 1 — Rating Service (TC-2.6 / TC-3.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TC-2.6 Post-ride rating ───────────────────────────────────────────
  describe('submitRating', () => {
    it('TC-2.6.1 PASS — rider submits valid 5-star rating', async () => {
      rpcMock.mockResolvedValue({
        data: { id: 'rating-001', rideId: 'ride-001', userId: 'user-001', driverId: 'drv-001', rating: 5, comment: 'Excellent driver!' },
        error: null,
      });

      const id = await RatingService.submitRating({
        rideId: 'ride-001',
        userId: 'user-001',
        driverId: 'drv-001',
        rating: 5,
        comment: 'Excellent driver!',
      });

      expect(id).toBe('rating-001');
      expect(rpcMock).toHaveBeenCalledWith('submit_rating', expect.objectContaining({
        p_ride_id: 'ride-001',
        p_driver_id: 'drv-001',
        p_rating: 5,
        p_comment: 'Excellent driver!',
      }));
    });

    it('TC-2.6.2 PASS — rider submits valid 1-star rating', async () => {
      rpcMock.mockResolvedValue({
        data: { id: 'rating-002', rideId: 'ride-002', userId: 'user-001', driverId: 'drv-001', rating: 1, comment: 'Very bad experience' },
        error: null,
      });

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
      rpcMock.mockResolvedValue({
        data: null,
        error: { message: 'Rating already submitted for this ride' },
      });

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
      rpcMock.mockResolvedValue({
        data: { id: 'rating-003', rideId: 'ride-003', userId: 'user-001', driverId: 'drv-001', rating: 5, tags: ['Clean Car', 'On Time', 'Friendly'] },
        error: null,
      });

      const id = await RatingService.submitRating({
        rideId: 'ride-003',
        userId: 'user-001',
        driverId: 'drv-001',
        rating: 5,
        tags: ['Clean Car', 'On Time', 'Friendly'],
      });

      expect(id).toBe('rating-003');
      expect(rpcMock).toHaveBeenCalledWith('submit_rating', expect.objectContaining({
        p_tags: ['Clean Car', 'On Time', 'Friendly'],
      }));
    });
  });

  // ── TC-2.6 Retrieve ratings ───────────────────────────────────────────
  describe('getDriverRatings', () => {
    it('TC-2.6.7 PASS — returns all ratings for a driver', async () => {
      fromMock.mockReturnValue(chainable({
        data: [
          { id: 'r1', rideId: 'ride-001', userId: 'user-001', driverId: 'drv-001', rating: 5 },
          { id: 'r2', rideId: 'ride-002', userId: 'user-002', driverId: 'drv-001', rating: 4 },
        ],
        error: null,
      }));

      const ratings = await RatingService.getDriverRatings('drv-001');

      expect(ratings).toHaveLength(2);
      expect(ratings[0].rating).toBe(5);
    });
  });

  describe('getRideRating', () => {
    it('TC-2.6.8 PASS — returns rating for a specific ride', async () => {
      fromMock.mockReturnValue(chainable({
        data: { id: 'r-001', rideId: 'ride-001', userId: 'user-001', driverId: 'drv-001', rating: 5 },
        error: null,
      }));

      const rating = await RatingService.getRideRating('ride-001', 'user-001');

      expect(rating).not.toBeNull();
      expect(rating!.rating).toBe(5);
    });

    it('TC-2.6.9 PASS — returns null when ride has no rating yet', async () => {
      fromMock.mockReturnValue(chainable({ data: null, error: null }));

      const rating = await RatingService.getRideRating('unrated-ride', 'user-001');

      expect(rating).toBeNull();
    });
  });

  // ── Driver aggregate stats ────────────────────────────────────────────
  describe('getDriverStats', () => {
    it('TC-2.6.5 PASS — returns aggregate rating stats for a driver', async () => {
      fromMock.mockReturnValue(chainable({
        data: { rating: 4, totalRatings: 3, ratingDistribution: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 1 } },
        error: null,
      }));

      const stats = await RatingService.getDriverStats('drv-001');

      expect(stats).not.toBeNull();
      expect(stats!.averageRating).toBe(4);
      expect(stats!.totalRatings).toBe(3);
    });

    it('TC-2.6.6 PASS — returns null when driver has no stats row', async () => {
      fromMock.mockReturnValue(chainable({ data: null, error: { message: 'not found' } }));

      const stats = await RatingService.getDriverStats('drv-new');

      expect(stats).toBeNull();
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
