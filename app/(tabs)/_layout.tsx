import { Tabs } from "expo-router";
import { Home, Clock, User, Gift, MapPin } from "lucide-react-native";
import React from "react";
import { StyleSheet, Platform } from "react-native";
import { AuthGuard } from "@/components/AuthGuard";
import { useTheme } from "@/hooks/useThemeStore";

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <AuthGuard>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: "#8E8E93",
          tabBarShowLabel: false,
          tabBarStyle: styles.tabBar,
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => <Home size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="rides"
          options={{
            title: "Rides",
            tabBarIcon: ({ color }) => <Clock size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: "Discover",
            tabBarIcon: ({ color }) => <MapPin size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="earn"
          options={{
            title: "Earn Free",
            tabBarIcon: ({ color }) => <Gift size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: "Account",
            tabBarIcon: ({ color }) => <User size={24} color={color} />,
          }}
        />
      </Tabs>
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: Platform.OS === 'ios' ? 30 : 20,
    height: 64,
    borderRadius: 32,
    borderTopWidth: 0,
    backgroundColor: '#1C1C1E',
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
});