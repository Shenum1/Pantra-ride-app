import React from 'react';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { BarChart3, Users, MessageSquare, TrendingUp, Settings, ShieldCheck, Receipt } from 'lucide-react-native';
import { useAdminAuth } from '@/hooks/useAdminAuthStore';
import AdminLogin from '@/components/AdminLogin';
import { Skeleton, SkeletonLine, ShimmerGroup } from '@/components/skeletons';

export default function AdminTabsLayout() {
  const { isAuthenticated, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#f8fafc' }}>
        <ShimmerGroup>
          <SkeletonLine
            width="50%"
            height={20}
            style={{ marginBottom: 20, alignSelf: 'center', backgroundColor: '#e5e7eb' }}
          />
          <Skeleton width="100%" height={120} borderRadius={16} style={{ marginBottom: 12, backgroundColor: '#e5e7eb' }} />
          <Skeleton width="100%" height={64} borderRadius={12} style={{ marginBottom: 12, backgroundColor: '#e5e7eb' }} />
          <Skeleton width="100%" height={64} borderRadius={12} style={{ marginBottom: 12, backgroundColor: '#e5e7eb' }} />
        </ShimmerGroup>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <BarChart3 size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: ({ color, size }) => (
            <Users size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="verification"
        options={{
          title: 'Verify',
          tabBarIcon: ({ color, size }) => (
            <ShieldCheck size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rides"
        options={{
          title: 'Rides',
          tabBarIcon: ({ color, size }) => (
            <Receipt size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: 'Support',
          tabBarIcon: ({ color, size }) => (
            <MessageSquare size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="marketing"
        options={{
          title: 'Marketing',
          tabBarIcon: ({ color, size }) => (
            <TrendingUp size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}