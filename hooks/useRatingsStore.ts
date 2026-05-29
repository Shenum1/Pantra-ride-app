import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Review } from "@/types";
import { useAuth } from "./useAuthStore";

const REVIEWS_STORAGE_KEY = "user_reviews";

export const [RatingsProvider, useRatings] = createContextHook(() => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pendingReviewDriverId, setPendingReviewDriverId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadReviews();
    }
  }, [user]);

  const loadReviews = async () => {
    if (!user) return;
    
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

  const addReview = async (driverId: string, rating: number, comment?: string) => {
    if (!user) return;
    
    try {
      const newReview: Review = {
        id: `review-${Date.now()}`,
        userId: user.id,
        driverId,
        rating,
        comment,
        createdAt: new Date(),
      };
      
      const updatedReviews = [...reviews, newReview];
      await saveReviews(updatedReviews);
      setPendingReviewDriverId(null);
      return newReview;
    } catch (error) {
      console.error("Error adding review:", error);
      throw error;
    }
  };

  const updateReview = async (reviewId: string, updates: Partial<Review>) => {
    try {
      const updatedReviews = reviews.map(review =>
        review.id === reviewId ? { ...review, ...updates } : review
      );
      
      await saveReviews(updatedReviews);
    } catch (error) {
      console.error("Error updating review:", error);
      throw error;
    }
  };

  const deleteReview = async (reviewId: string) => {
    try {
      const updatedReviews = reviews.filter(review => review.id !== reviewId);
      await saveReviews(updatedReviews);
    } catch (error) {
      console.error("Error deleting review:", error);
      throw error;
    }
  };

  const getDriverReviews = (driverId: string): Review[] => {
    return reviews.filter(review => review.driverId === driverId);
  };

  const getUserReviews = (): Review[] => {
    if (!user) return [];
    return reviews.filter(review => review.userId === user.id);
  };

  const setPendingReview = (driverId: string) => {
    setPendingReviewDriverId(driverId);
  };

  const clearPendingReview = () => {
    setPendingReviewDriverId(null);
  };

  return {
    reviews,
    pendingReviewDriverId,
    addReview,
    updateReview,
    deleteReview,
    getDriverReviews,
    getUserReviews,
    setPendingReview,
    clearPendingReview,
  };
});