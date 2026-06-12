import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Review } from "@/types";
import { RatingService } from "@/lib/rating-service";
import { useAuth } from "./useAuthStore";

const REVIEWS_STORAGE_KEY = "user_reviews";

export const [RatingsProvider, useRatings] = createContextHook(() => {
  const { user } = useAuth();
  const isSupabaseUser = !!user?.id && user.id !== 'test-rider';
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (user) {
      loadReviews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadReviews = async () => {
    if (!user) return;

    if (isSupabaseUser) {
      try {
        const userRatings = await RatingService.getUserRatings(user.id);
        setReviews(userRatings.map((r) => ({
          id: r.id ?? '',
          rideId: r.rideId,
          userId: r.userId,
          driverId: r.driverId,
          rating: r.rating,
          comment: r.comment,
          tags: r.tags,
          createdAt: r.createdAt ?? new Date(),
        })));
      } catch (error) {
        console.error("Error loading reviews from Supabase:", error);
      }
      return;
    }

    try {
      const storedReviews = await AsyncStorage.getItem(`${REVIEWS_STORAGE_KEY}_${user.id}`);
      if (storedReviews) {
        setReviews(JSON.parse(storedReviews));
      }
    } catch (error) {
      console.error("Error loading reviews:", error);
    }
  };

  const saveReviews = async (updatedReviews: Review[]) => {
    if (!user) return;

    try {
      await AsyncStorage.setItem(
        `${REVIEWS_STORAGE_KEY}_${user.id}`,
        JSON.stringify(updatedReviews)
      );
      setReviews(updatedReviews);
    } catch (error) {
      console.error("Error saving reviews:", error);
      throw error;
    }
  };

  const addReview = async (rideId: string, driverId: string, rating: number, comment?: string, tags?: string[]) => {
    if (!user) return;

    if (isSupabaseUser) {
      const id = await RatingService.submitRating({
        rideId,
        userId: user.id,
        driverId,
        rating,
        comment,
        tags,
      });

      const newReview: Review = {
        id,
        rideId,
        userId: user.id,
        driverId,
        rating,
        comment,
        tags,
        createdAt: new Date(),
      };

      setReviews((prev) => [...prev, newReview]);
      return newReview;
    }

    try {
      const newReview: Review = {
        id: `review-${Date.now()}`,
        rideId,
        userId: user.id,
        driverId,
        rating,
        comment,
        tags,
        createdAt: new Date(),
      };

      const updatedReviews = [...reviews, newReview];
      await saveReviews(updatedReviews);
      return newReview;
    } catch (error) {
      console.error("Error adding review:", error);
      throw error;
    }
  };

  const getRideRating = async (rideId: string): Promise<Review | null> => {
    if (!user) return null;

    if (isSupabaseUser) {
      const rating = await RatingService.getRideRating(rideId, user.id);
      if (!rating) return null;
      return {
        id: rating.id ?? '',
        rideId: rating.rideId,
        userId: rating.userId,
        driverId: rating.driverId,
        rating: rating.rating,
        comment: rating.comment,
        tags: rating.tags,
        createdAt: rating.createdAt ?? new Date(),
      };
    }

    return reviews.find((review) => review.rideId === rideId) ?? null;
  };

  return {
    reviews,
    addReview,
    getRideRating,
  };
});
