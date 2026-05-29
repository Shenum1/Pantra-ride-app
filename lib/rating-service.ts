import { DatabaseService } from './database-service';

export interface Rating {
  id?: string;
  rideId: string;
  userId: string;
  driverId: string;
  rating: number;
  comment?: string;
  tags?: string[];
  createdAt?: Date;
}

export interface DriverRatingStats {
  driverId: string;
  averageRating: number;
  totalRatings: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export class RatingService {
  static async submitRating(rating: Omit<Rating, 'id' | 'createdAt'>): Promise<string> {
    try {
      const existingRating = await DatabaseService.query('ratings', [
        { field: 'rideId', operator: '==', value: rating.rideId },
        { field: 'userId', operator: '==', value: rating.userId },
      ]);

      if (existingRating.length > 0) {
        throw new Error('Rating already submitted for this ride');
      }

      const ratingId = await DatabaseService.create('ratings', rating);

      await this.updateDriverRating(rating.driverId);

      return ratingId;
    } catch (error) {
      console.error('Error submitting rating:', error);
      throw error;
    }
  }

  static async updateDriverRating(driverId: string): Promise<void> {
    try {
      const ratings = await DatabaseService.query('ratings', [
        { field: 'driverId', operator: '==', value: driverId },
      ]);

      if (ratings.length === 0) return;

      const totalRating = ratings.reduce((sum: number, r: any) => sum + r.rating, 0);
      const averageRating = totalRating / ratings.length;

      const ratingDistribution = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };

      ratings.forEach((r: any) => {
        ratingDistribution[r.rating as keyof typeof ratingDistribution]++;
      });

      await DatabaseService.update('drivers', driverId, {
        rating: Math.round(averageRating * 10) / 10,
        totalRatings: ratings.length,
        ratingDistribution,
      });
    } catch (error) {
      console.error('Error updating driver rating:', error);
    }
  }

  static async getDriverRatings(driverId: string): Promise<Rating[]> {
    try {
      const ratings = await DatabaseService.query(
        'ratings',
        [{ field: 'driverId', operator: '==', value: driverId }],
        'createdAt',
        'desc',
        50
      );
      return ratings as Rating[];
    } catch (error) {
      console.error('Error getting driver ratings:', error);
      return [];
    }
  }

  static async getUserRatings(userId: string): Promise<Rating[]> {
    try {
      const ratings = await DatabaseService.query(
        'ratings',
        [{ field: 'userId', operator: '==', value: userId }],
        'createdAt',
        'desc',
        50
      );
      return ratings as Rating[];
    } catch (error) {
      console.error('Error getting user ratings:', error);
      return [];
    }
  }

  static async getRideRating(rideId: string): Promise<Rating | null> {
    try {
      const ratings = await DatabaseService.query('ratings', [
        { field: 'rideId', operator: '==', value: rideId },
      ]);

      return ratings.length > 0 ? (ratings[0] as Rating) : null;
    } catch (error) {
      console.error('Error getting ride rating:', error);
      return null;
    }
  }

  static async getDriverStats(driverId: string): Promise<DriverRatingStats | null> {
    try {
      const driver = await DatabaseService.get('drivers', driverId);
      if (!driver) return null;

      const driverData = driver as any;

      return {
        driverId,
        averageRating: driverData.rating || 0,
        totalRatings: driverData.totalRatings || 0,
        ratingDistribution: driverData.ratingDistribution || {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        },
      };
    } catch (error) {
      console.error('Error getting driver stats:', error);
      return null;
    }
  }

  static getCommonTags(): string[] {
    return [
      'Friendly',
      'Professional',
      'Clean Car',
      'Safe Driver',
      'Good Music',
      'Quiet',
      'Helpful',
      'On Time',
      'Smooth Ride',
      'Great Conversation',
    ];
  }
}
