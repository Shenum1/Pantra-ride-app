import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { View } from "react-native";
import Toast from 'react-native-toast-message';
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LocationProvider } from "@/hooks/useLocationStore";
import { RideProvider } from "@/hooks/useRideStore";
import { AuthProvider } from "@/hooks/useAuthStore";
import { PaymentProvider } from "@/hooks/usePaymentStore";
import { SavedLocationsProvider } from "@/hooks/useSavedLocationsStore";
import { PromotionsProvider } from "@/hooks/usePromotionsStore";
import { PointsProvider } from "@/hooks/usePointsStore";
import { RatingsProvider } from "@/hooks/useRatingsStore";
import { EarnProvider } from "@/hooks/useEarnStore";
import { DriverStoreProvider } from "@/hooks/useDriverStore";
import { DriverAuthProvider } from "@/hooks/useDriverAuthStore";
import { AdminAuthProvider } from "@/hooks/useAdminAuthStore";
import { ThemeProvider } from "@/hooks/useThemeStore";
import { WeatherProvider } from "@/hooks/useWeatherStore";
import { WalletProvider } from "@/hooks/useWalletStore";

import { trpc, trpcClient } from "@/lib/trpc";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <>
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="role-selection" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="driver-login" options={{ headerShown: false }} />
        <Stack.Screen name="driver-signup" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(driver-tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="search" options={{ title: "Set destination" }} />
        <Stack.Screen name="ride-confirmation" options={{ title: "Ride Details" }} />
        <Stack.Screen name="ride-progress" options={{ title: "Your Ride", headerShown: false }} />
        <Stack.Screen name="schedule-ride" options={{ title: "Schedule Ride" }} />
        <Stack.Screen name="payment-methods" options={{ title: "Payment Methods" }} />
        <Stack.Screen name="add-payment-method" options={{ title: "Add Payment Method" }} />
        <Stack.Screen name="saved-locations" options={{ title: "Saved Places" }} />
        <Stack.Screen name="add-location" options={{ title: "Add Location" }} />
        <Stack.Screen name="promotions" options={{ title: "Promotions" }} />
        <Stack.Screen name="rate-driver" options={{ title: "Rate Your Driver" }} />
        <Stack.Screen name="share-ride" options={{ title: "Share Your Ride" }} />
        <Stack.Screen name="earn-history" options={{ title: "Earning History" }} />
        <Stack.Screen name="driver-dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="driver-earnings" options={{ title: "Driver Earnings" }} />
        <Stack.Screen name="driver-achievements" options={{ headerShown: false }} />
        <Stack.Screen name="driver-goals" options={{ headerShown: false }} />
        <Stack.Screen name="driver-trip-history" options={{ headerShown: false }} />
        <Stack.Screen name="driver-documents" options={{ headerShown: false }} />
        <Stack.Screen name="personal-info" options={{ title: "Personal Info" }} />
        <Stack.Screen name="family-profile" options={{ title: "Family Profile" }} />
        <Stack.Screen name="safety" options={{ title: "Safety" }} />
        <Stack.Screen name="login-security" options={{ title: "Login & Security" }} />
        <Stack.Screen name="privacy" options={{ title: "Privacy" }} />
        <Stack.Screen name="expense-rides" options={{ title: "Expense Rides" }} />
        <Stack.Screen name="support" options={{ title: "Support" }} />
        <Stack.Screen name="about" options={{ title: "About" }} />
        <Stack.Screen name="language" options={{ title: "Language" }} />
        <Stack.Screen name="communication-preferences" options={{ title: "Communication" }} />
        <Stack.Screen name="calendars" options={{ title: "Calendars" }} />
        <Stack.Screen name="enter-promo-code" options={{ title: "Enter Promo Code" }} />
        <Stack.Screen name="my-rides" options={{ title: "My Rides" }} />
        <Stack.Screen name="wallet" options={{ title: "My Wallet" }} />
        <Stack.Screen name="wallet-add-money" options={{ title: "Add Money" }} />
        <Stack.Screen name="wallet-withdraw" options={{ title: "Withdraw" }} />
        <Stack.Screen name="wallet-transaction-details" options={{ title: "Transaction Details" }} />
        <Stack.Screen name="wallet-add-bank" options={{ title: "Add Bank Account" }} />
        <Stack.Screen name="wallet-bank-accounts" options={{ title: "Bank Accounts" }} />
        <Stack.Screen name="backend-test" options={{ title: "Backend Test" }} />
        <Stack.Screen name="firebase-diagnostics" options={{ title: "Firebase Diagnostics" }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />

      </Stack>
      <Toast />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const message = args[0];
      if (
        typeof message === 'string' && 
        (message.includes('PostHog') || message.includes('PostHogFetchNetworkError'))
      ) {
        return;
      }
      originalConsoleError.apply(console, args);
    };
  }, []);

  return (
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <View style={{ flex: 1 }}>
            <ThemeProvider>
              <AuthProvider>
              <DriverAuthProvider>
              <AdminAuthProvider>
                <PaymentProvider>
                <WalletProvider>
                <PromotionsProvider>
                <PointsProvider>
                  <SavedLocationsProvider>
                    <EarnProvider>
                      <DriverStoreProvider>
                        <LocationProvider>
                          <WeatherProvider>
                            <RatingsProvider>
                              <RideProvider>
                                <RootLayoutNav />
                              </RideProvider>
                            </RatingsProvider>
                          </WeatherProvider>
                        </LocationProvider>
                      </DriverStoreProvider>
                    </EarnProvider>
                  </SavedLocationsProvider>
                </PointsProvider>
                </PromotionsProvider>
                </WalletProvider>
              </PaymentProvider>
              </AdminAuthProvider>
              </DriverAuthProvider>
              </AuthProvider>
            </ThemeProvider>
          </View>
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  );
}