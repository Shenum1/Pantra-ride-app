import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuthStore";
import { PaymentMethodsService } from "@/lib/payment-methods-service";
import { PaymentMethod } from "@/types";

const PAYMENT_METHODS_STORAGE_KEY = "payment_methods";

export const [PaymentProvider, usePayment] = createContextHook(() => {
  const { user } = useAuth();
  const isSupabaseUser = !!user?.id && user.id !== "test-rider";
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const queryClient = useQueryClient();

  const paymentMethodsQueryKey = ["paymentMethods", user?.id ?? null, isSupabaseUser] as const;

  // Fetch payment methods
  const { data: fetchedPaymentMethods, isLoading } = useQuery({
    queryKey: paymentMethodsQueryKey,
    queryFn: async () => {
      if (isSupabaseUser && user) {
        try {
          return await PaymentMethodsService.getPaymentMethods(user.id);
        } catch (error) {
          console.error("Error fetching payment methods from Supabase:", error);
          return [];
        }
      }

      try {
        const storedMethods = await AsyncStorage.getItem(PAYMENT_METHODS_STORAGE_KEY);
        if (storedMethods) {
          return JSON.parse(storedMethods) as PaymentMethod[];
        }
        return [];
      } catch (error) {
        console.error("Error fetching payment methods:", error);
        return [];
      }
    },
  });

  useEffect(() => {
    if (fetchedPaymentMethods) {
      setPaymentMethods(fetchedPaymentMethods);
    }
  }, [fetchedPaymentMethods]);

  const refreshPaymentMethods = async (): Promise<PaymentMethod[]> => {
    await queryClient.invalidateQueries({ queryKey: ["paymentMethods"] });
    if (isSupabaseUser && user) {
      const refreshed = await PaymentMethodsService.getPaymentMethods(user.id);
      setPaymentMethods(refreshed);
      return refreshed;
    }
    return paymentMethods;
  };

  const addPaymentMethod = async (newMethod: Omit<PaymentMethod, "id">) => {
    try {
      if (isSupabaseUser && user) {
        await PaymentMethodsService.addPaymentMethod(user.id, newMethod);
        await refreshPaymentMethods();
        return;
      }

      const newPaymentMethod: PaymentMethod = {
        ...newMethod,
        id: `payment-${Date.now()}`,
      };

      // If this is the first payment method or isDefault is true, make it default
      if (paymentMethods.length === 0 || newMethod.isDefault) {
        // Set all other methods to non-default
        const updatedMethods = paymentMethods.map(method => ({
          ...method,
          isDefault: false,
        }));
        const newMethods = [...updatedMethods, { ...newPaymentMethod, isDefault: true }];
        setPaymentMethods(newMethods);
        await AsyncStorage.setItem(PAYMENT_METHODS_STORAGE_KEY, JSON.stringify(newMethods));
      } else {
        const newMethods = [...paymentMethods, newPaymentMethod];
        setPaymentMethods(newMethods);
        await AsyncStorage.setItem(PAYMENT_METHODS_STORAGE_KEY, JSON.stringify(newMethods));
      }
    } catch (error) {
      console.error("Error adding payment method:", error);
      throw error;
    }
  };

  const removePaymentMethod = async (id: string) => {
    try {
      if (isSupabaseUser && user) {
        await PaymentMethodsService.removePaymentMethod(user.id, id);
        await refreshPaymentMethods();
        return;
      }

      const methodToRemove = paymentMethods.find(method => method.id === id);
      const updatedMethods = paymentMethods.filter(method => method.id !== id);

      // If we're removing the default method, make another one default
      if (methodToRemove?.isDefault && updatedMethods.length > 0) {
        updatedMethods[0].isDefault = true;
      }

      setPaymentMethods(updatedMethods);
      await AsyncStorage.setItem(PAYMENT_METHODS_STORAGE_KEY, JSON.stringify(updatedMethods));
    } catch (error) {
      console.error("Error removing payment method:", error);
      throw error;
    }
  };

  const setDefaultPaymentMethod = async (id: string) => {
    try {
      if (isSupabaseUser && user) {
        await PaymentMethodsService.setDefaultPaymentMethod(user.id, id);
        await refreshPaymentMethods();
        return;
      }

      const updatedMethods = paymentMethods.map(method => ({
        ...method,
        isDefault: method.id === id,
      }));

      setPaymentMethods(updatedMethods);
      await AsyncStorage.setItem(PAYMENT_METHODS_STORAGE_KEY, JSON.stringify(updatedMethods));
    } catch (error) {
      console.error("Error setting default payment method:", error);
      throw error;
    }
  };

  const getDefaultPaymentMethod = (): PaymentMethod | undefined => {
    return paymentMethods.find(method => method.isDefault);
  };

  return {
    paymentMethods,
    isLoading,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
    getDefaultPaymentMethod,
  };
});
