import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuthStore';

export interface SupabasePromotion {
  id: string;
  code: string;
  description: string;
  discountPercentage: number;
  maxDiscountNGN: number | null;
  maxUses: number | null;
  usedCount: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  createdAt: string;
}

export const [PromotionsProvider, usePromotions] = createContextHook(() => {
  const { user } = useAuth();
  const [promotions, setPromotions] = useState<SupabasePromotion[]>([]);
  const [activePromoCode, setActivePromoCode] = useState<string | null>(null);
  const [activePromotion, setActivePromotion] = useState<SupabasePromotion | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadPromotions = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .order('createdAt', { ascending: false });
      if (!error && data) setPromotions(data as SupabasePromotion[]);
    } catch (e) {
      console.error('Error loading promotions:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const applyPromoCode = useCallback(async (
    code: string
  ): Promise<{ success: boolean; message: string; discount?: number }> => {
    const userId = user?.id;
    if (!userId || userId === 'test-rider') {
      return { success: false, message: 'Sign in to use promo codes' };
    }

    // 1. Validate code in Supabase
    const { data: promoRows, error } = await supabase
      .from('promotions')
      .select('*')
      .ilike('code', code)
      .eq('isActive', true)
      .gt('validUntil', new Date().toISOString())
      .limit(1);

    if (error || !promoRows || promoRows.length === 0) {
      return { success: false, message: 'Invalid or expired promo code' };
    }

    const promo = promoRows[0] as SupabasePromotion;

    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return { success: false, message: 'This promo code has reached its usage limit' };
    }

    // 2. Check if user already used it
    const { data: used } = await supabase
      .from('user_promo_uses')
      .select('id')
      .eq('userId', userId)
      .eq('promoId', promo.id)
      .maybeSingle();

    if (used) {
      return { success: false, message: 'You have already used this promo code' };
    }

    setActivePromoCode(promo.code);
    setActivePromotion(promo);
    return {
      success: true,
      message: `${promo.description} applied!`,
      discount: promo.discountPercentage,
    };
  }, [user]);

  // Promo usage is recorded by the server when the ride is created (rides.create); the phone
  // can no longer write it, and recording it here as well counted every promo ride twice.
  // This only clears the promo from the screen once it has been used.
  const markPromoAsUsed = useCallback(async (_code: string, _rideId?: string) => {
    setActivePromoCode(null);
    setActivePromotion(null);
  }, []);

  const clearActivePromo = useCallback(() => {
    setActivePromoCode(null);
    setActivePromotion(null);
  }, []);

  const getActivePromotion = useCallback((): SupabasePromotion | undefined => {
    return activePromotion ?? undefined;
  }, [activePromotion]);

  const getValidPromotions = useCallback((): SupabasePromotion[] => {
    return promotions.filter(p => new Date(p.validUntil) > new Date());
  }, [promotions]);

  return {
    promotions,
    isLoading,
    activePromoCode,
    loadPromotions,
    applyPromoCode,
    markPromoAsUsed,
    clearActivePromo,
    getActivePromotion,
    getValidPromotions,
  };
});
