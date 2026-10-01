import { Tabs } from "expo-router";
import { Home, MapPin, Wallet, User } from "lucide-react-native";
import React from "react";
import { StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { AuthGuard } from "@/components/AuthGuard";
import { DriverVerificationGate } from "@/components/DriverVerificationGate";
import { useTheme } from "@/hooks/useThemeStore";

export default function DriverTabLayout() {
  const { colors, isDark } = useTheme();

  return (
    <AuthGuard requireDriver>
    <DriverVerificationGate>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <BlurView
            intensity={65}
            tint={isDark ? "dark" : "light"}
            style={styles.tabBarBackground}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Home size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "Trips",
          tabBarIcon: ({ color }) => <MapPin size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Wallet",
          tabBarIcon: ({ color }) => <Wallet size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <User size={20} color={color} />,
        }}
      />
    </Tabs>
    </DriverVerificationGate>
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: '50%',
    width: 280,
    marginLeft: -140,
    bottom: Platform.OS === 'ios' ? 30 : 20,
    height: 56,
    borderRadius: 28,
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    paddingTop: 6,
    paddingBottom: 6,
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  tabBarBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    overflow: 'hidden',
  },
});
