import { Tabs } from "expo-router";
import { Home, Clock, User, Gift, MapPin } from "lucide-react-native";
import React from "react";
import { StyleSheet, Platform } from "react-native";
import { AuthGuard } from "@/components/AuthGuard";
import { useTheme } from "@/hooks/useThemeStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  return (
    <AuthGuard>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.gray,
          tabBarStyle: [
            styles.tabBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
              height: Platform.OS === 'ios' ? 84 + insets.bottom : 68,
            }
          ],
          tabBarLabelStyle: [
            styles.tabBarLabel,
            { color: colors.textSecondary }
          ],
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
    borderTopWidth: 1,
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});