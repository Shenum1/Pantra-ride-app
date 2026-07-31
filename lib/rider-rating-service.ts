import { supabase } from './supabase';

export interface RiderRating {
  id?: string;
  rideId: string;
  driverId: string;
  userId: string;
  rating: number;
  comment?: string;
  tags?: string[];
  createdAt?: Date;
}

function mapRating(row: any): RiderRating {
  return {
    id: row.id,
    rideId: row.rideId,
    driverId: row.driverId,
    userId: row.userId,
    rating: Number(row.rating),
    comment: row.comment ?? undefined,
    tags: row.tags ?? undefined,
    createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
  };
}

export class RiderRatingService {
  static async submitRating(rating: Omit<RiderRating, 'id' | 'createdAt' | 'driverId'>): Promise<string> {
    const { data, error } = await supabase.rpc('submit_rider_rating', {
      p_ride_id: rating.rideId,
      p_user_id: rating.userId,
      p_rating: rating.rating,
      p_comment: rating.comment ?? null,
      p_tags: rating.tags ?? null,
    });

    if (error) throw new Error(error.message);
    return (data as { id: string }).id;
  }

  static async getRideRating(rideId: string, driverId: string): Promise<RiderRating | null> {
    try {
      const { data, error } = await supabase
        .from('driver_ratings_of_riders')
        .select('*')
        .eq('rideId', rideId)
        .eq('driverId', driverId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data ? mapRating(data) : null;
    } catch (error) {
      console.error('Error getting ride rating:', error);
      return null;
    }
  }

  static getCommonTags(): string[] {
    return [
      'Friendly',
      'Respectful',
      'On Time',
      'Clear Pickup',
      'Polite',
      'Great Communication',
    ];
  }
}
