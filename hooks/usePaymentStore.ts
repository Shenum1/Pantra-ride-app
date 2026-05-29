import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { mockPaymentMethods } from "@/mocks/paymentMethods";
import { PaymentMethod } from "@/types";

const PAYMENT_METHODS_STORAGE_KEY = "payment_methods";

export const [PaymentProvider, usePayment] = createContextHook(() => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Fetch payment methods
  const { data: fetchedPaymentMethods, isLoading } = useQuery({
    queryKey: ["paymentMethods"],
    queryFn: async () => {
      try {
        const storedMethods = await AsyncStorage.getItem(PAYMENT_METHODS_STORAGE_KEY);
        if (storedMethods) {
          return JSON.parse(storedMethods) as PaymentMethod[];
        }
        // If no stored methods, use mock data
        await AsyncStorage.setItem(PAYMENT_METHODS_STORAGE_KEY, JSON.stringify(mockPaymentMethods));
        return mockPaymentMethods;
      } catch (error) {
        console.error("Error fetching payment methods:", error);
        return mockPaymentMethods;
      }
    },
  });

  useEffect(() => {
    if (fetchedPaymentMethods) {
      setPaymentMethods(fetchedPaymentMethods);
    }
  }, [fetchedPaymentMethods]);

  const addPaymentMethod = async (newMethod: Omit<PaymentMethod, "id">) => {
    try {
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
        const newMethods = [...updatedMethods, newPaymentMethod];
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