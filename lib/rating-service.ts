import { supabase } from './supabase';

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

function mapRating(row: any): Rating {
  return {
    id: row.id,
    rideId: row.rideId,
    userId: row.userId,
    driverId: row.driverId,
    rating: Number(row.rating),
    comment: row.comment ?? undefined,
    tags: row.tags ?? undefined,
    createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
  };
}

export class RatingService {
  static async submitRating(rating: Omit<Rating, 'id' | 'createdAt'>): Promise<string> {
    const { data, error } = await supabase.rpc('submit_rating', {
      p_ride_id: rating.rideId,
      p_driver_id: rating.driverId,
      p_rating: rating.rating,
      p_comment: rating.comment ?? null,
      p_tags: rating.tags ?? null,
    });

    if (error) throw new Error(error.message);
    return (data as { id: string }).id;
  }

  static async getDriverRatings(driverId: string): Promise<Rating[]> {
    try {
      const { data, error } = await supabase
        .from('ratings')
        .select('*')
        .eq('driverId', driverId)
        .order('createdAt', { ascending: false })
        .limit(50);

      if (error) throw new Error(error.message);
      return (data ?? []).map(mapRating);
    } catch (error) {
      console.error('Error getting driver ratings:', error);
      return [];
    }
  }

  static async getUserRatings(userId: string): Promise<Rating[]> {
    try {
      const { data, error } = await supabase
        .from('ratings')
        .select('*')
        .eq('userId', userId)
        .order('createdAt', { ascending: false })
        .limit(50);

      if (error) throw new Error(error.message);
      return (data ?? []).map(mapRating);
    } catch (error) {
      console.error('Error getting user ratings:', error);
      return [];
    }
  }

  static async getRideRating(rideId: string, userId: string): Promise<Rating | null> {
    try {
      const { data, error } = await supabase
        .from('ratings')
        .select('*')
        .eq('rideId', rideId)
        .eq('userId', userId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data ? mapRating(data) : null;
    } catch (error) {
      console.error('Error getting ride rating:', error);
      return null;
    }
  }

  static async getDriverStats(driverId: string): Promise<DriverRatingStats | null> {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('rating, totalRatings, ratingDistribution')
        .eq('id', driverId)
        .single();

      if (error) return null;

      return {
        driverId,
        averageRating: Number(data.rating ?? 0),
        totalRatings: data.totalRatings ?? 0,
        ratingDistribution: data.ratingDistribution ?? {
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
