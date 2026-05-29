import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { mockPromotions } from "@/mocks/promotions";
import { Promotion } from "@/types";

const PROMOTIONS_STORAGE_KEY = "promotions";

export const [PromotionsProvider, usePromotions] = createContextHook(() => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [activePromoCode, setActivePromoCode] = useState<string | null>(null);

  // Fetch promotions
  const { data: fetchedPromotions, isLoading } = useQuery({
    queryKey: ["promotions"],
    queryFn: async () => {
      try {
        const storedPromotions = await AsyncStorage.getItem(PROMOTIONS_STORAGE_KEY);
        if (storedPromotions) {
          return JSON.parse(storedPromotions) as Promotion[];
        }
        // If no stored promotions, use mock data
        await AsyncStorage.setItem(PROMOTIONS_STORAGE_KEY, JSON.stringify(mockPromotions));
        return mockPromotions;
      } catch (error) {
        console.error("Error fetching promotions:", error);
        return mockPromotions;
      }
    },
  });

  useEffect(() => {
    if (fetchedPromotions) {
      // Filter out expired promotions
      const validPromotions = fetchedPromotions.filter(
        promo => new Date(promo.validUntil) > new Date()
      );
      setPromotions(validPromotions);
    }
  }, [fetchedPromotions]);

  const addPromotion = async (newPromotion: Omit<Promotion, "id">) => {
    try {
      const promoWithId: Promotion = {
        ...newPromotion,
        id: `promo-${Date.now()}`,
      };
      
      const updatedPromotions = [...promotions, promoWithId];
      setPromotions(updatedPromotions);
      await AsyncStorage.setItem(PROMOTIONS_STORAGE_KEY, JSON.stringify(updatedPromotions));
    } catch (error) {
      console.error("Error adding promotion:", error);
      throw error;
    }
  };

  const applyPromoCode = (code: string): { success: boolean; message: string; discount?: number } => {
    const promo = promotions.find(
      p => p.code.toUpperCase() === code.toUpperCase() && !p.isUsed
    );
    
    if (!promo) {
      return { success: false, message: "Invalid or expired promo code" };
    }
    
    setActivePromoCode(promo.code);
    return {
      success: true,
      message: `${promo.description} applied!`,
      discount: promo.discountPercentage,
    };
  };

  const markPromoAsUsed = async (code: string) => {
    try {
      const updatedPromotions = promotions.map(promo =>
        promo.code.toUpperCase() === code.toUpperCase()
          ? { ...promo, isUsed: true }
          : promo
      );
      
      setPromotions(updatedPromotions);
      setActivePromoCode(null);
      await AsyncStorage.setItem(PROMOTIONS_STORAGE_KEY, JSON.stringify(updatedPromotions));
    } catch (error) {
      console.error("Error marking promo as used:", error);
      throw error;
    }
  };

  const clearActivePromo = () => {
    setActivePromoCode(null);
  };

  const getActivePromotion = (): Promotion | undefined => {
    if (!activePromoCode) return undefined;
    return promotions.find(p => p.code === activePromoCode);
  };

  const getValidPromotions = (): Promotion[] => {
    return promotions.filter(promo => !promo.isUsed);
  };

  return {
    promotions,
    isLoading,
    activePromoCode,
    addPromotion,
    applyPromoCode,
    markPromoAsUsed,
    clearActivePromo,
    getActivePromotion,
    getValidPromotions,
  };
});