import { Tabs } from "expo-router";
import { Home, User, Gift, MapPin } from "lucide-react-native";
import React from "react";
import { StyleSheet, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { AuthGuard } from "@/components/AuthGuard";
import { MAX_CONTENT_WIDTH } from "@/components/ResponsiveShell";
import { useTheme } from "@/hooks/useThemeStore";

const BAR_WIDTH = 280;
const MIN_SIDE_INSET = 16;
const MIN_BOTTOM_INSET = 20;

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // On web, ResponsiveShell caps the app column at MAX_CONTENT_WIDTH, and the
  // bar is positioned inside that column — not the full browser window.
  const containerWidth = Platform.OS === 'web' ? Math.min(windowWidth, MAX_CONTENT_WIDTH) : windowWidth;
  const sideInset = Math.max(MIN_SIDE_INSET, (containerWidth - BAR_WIDTH) / 2);
  const bottomInset = Math.max(MIN_BOTTOM_INSET, insets.bottom);

  return (
    <AuthGuard>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarShowLabel: false,
          // bottom-tabs sets `start: 0, end: 0` on the bar, and native gives
          // start/end priority over left/right — so the inset must be set on both.
          tabBarStyle: [
            styles.tabBar,
            { start: sideInset, end: sideInset, left: sideInset, right: sideInset, bottom: bottomInset },
          ],
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
