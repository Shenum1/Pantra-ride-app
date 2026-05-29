import { Tabs } from "expo-router";
import { Home, MapPin, Wallet, User } from "lucide-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/hooks/useThemeStore";

export default function DriverTabLayout() {
  const { colors, isDark } = useTheme();
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <View style={[
            styles.tabBarBackground,
            { backgroundColor: isDark ? 'rgba(28, 28, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)' }
          ]} />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && {
              ...styles.focusedIconContainer,
              backgroundColor: colors.primaryLight,
              shadowColor: colors.primary,
            }]}>
              <Home size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "Trips",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && {
              ...styles.focusedIconContainer,
              backgroundColor: colors.primaryLight,
              shadowColor: colors.primary,
            }]}>
              <MapPin size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Wallet",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && {
              ...styles.focusedIconContainer,
              backgroundColor: colors.primaryLight,
              shadowColor: colors.primary,
            }]}>
              <Wallet size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && {
              ...styles.focusedIconContainer,
              backgroundColor: colors.primaryLight,
              shadowColor: colors.primary,
            }]}>
              <User size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    height: 65,
    borderRadius: 32,
    paddingBottom: 8,
    paddingTop: 8,
    borderTopWidth: 0,
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  tabBarBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: -2,
  },
  tabBarItem: {
    paddingVertical: 8,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0,
  },
  focusedIconContainer: {
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
});