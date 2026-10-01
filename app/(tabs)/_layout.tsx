import { Tabs } from "expo-router";
import { Home, User, Gift, MapPin } from "lucide-react-native";
import React from "react";
import { StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { AuthGuard } from "@/components/AuthGuard";
import { useTheme } from "@/hooks/useThemeStore";

export default function TabLayout() {
  const { colors, isDark } = useTheme();

  return (
    <AuthGuard>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarShowLabel: false,
          tabBarStyle: styles.tabBar,
          tabBarBackground: () => (
            <BlurView
              intensity={65}
              tint={isDark ? "dark" : "light"}
              style={styles.tabBarBackground}
            />
          ),
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => <Home size={20} color={color} />,
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: "Discover",
            tabBarIcon: ({ color }) => <MapPin size={20} color={color} />,
          }}
        />
        <Tabs.Screen
          name="earn"
          options={{
            title: "Gift",
            tabBarIcon: ({ color }) => <Gift size={20} color={color} />,
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: "Account",
            tabBarIcon: ({ color }) => <User size={20} color={color} />,
          }}
        />
        <Tabs.Screen
          name="rides"
          options={{
            href: null,
          }}
        />
      </Tabs>
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
