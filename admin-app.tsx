import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import { AdminAuthProvider, useAdminAuth } from "@/hooks/useAdminAuthStore";
import { ThemeProvider } from "@/hooks/useThemeStore";
import { trpc, trpcClient } from "@/lib/trpc";
import AdminLogin from "@/components/AdminLogin";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AdminLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="admin-login" options={{ headerShown: false }} />
      <Stack.Screen name="(admin-tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="admin/dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="admin/users" options={{ headerShown: false }} />
      <Stack.Screen name="admin/support" options={{ headerShown: false }} />
      <Stack.Screen name="admin/marketing" options={{ headerShown: false }} />
      <Stack.Screen name="admin/discovery" options={{ headerShown: false }} />
      <Stack.Screen name="admin/notifications" options={{ headerShown: false }} />
      <Stack.Screen name="admin/finance" options={{ headerShown: false }} />
      <Stack.Screen name="admin/settings" options={{ headerShown: false }} />
    </Stack>
  );
}

function AdminAppContent() {
  const { isAuthenticated } = useAdminAuth();
  
  if (!isAuthenticated) {
    return <AdminLogin />;
  }
  
  return <AdminLayoutNav />;
}

export default function AdminApp() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={styles.container}>
          <ThemeProvider>
            <AdminAuthProvider>
              <AdminAppContent />
            </AdminAuthProvider>
          </ThemeProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});