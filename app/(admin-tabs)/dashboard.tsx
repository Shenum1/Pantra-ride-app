import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Skeleton, SkeletonLine, ShimmerGroup } from '@/components/skeletons';

import { LinearGradient } from 'expo-linear-gradient';
import {
  Users,
  Car,
  Wallet,
  AlertCircle,
  CheckCircle,
  MapPin,
  Activity,
  User as UserIcon
} from 'lucide-react-native';
import { trpc } from '@/lib/trpc';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, isLoading = false }) => (
  <View style={styles.statCard}>
    <LinearGradient colors={[color, `${color}80`]} style={styles.statGradient}>
      <View style={styles.statHeader}>
        <Icon size={24} color="white" />
        {isLoading ? (
          <Skeleton width={54} height={22} borderRadius={4} style={styles.statSkeleton} />
        ) : (
          <Text style={styles.statValue}>{value}</Text>
        )}
      </View>
      <Text style={styles.statTitle}>{title}</Text>
    </LinearGradient>
  </View>
);

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
}

const ACTIVITY_ICONS: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  user: UserIcon,
  driver: Car,
  ride: MapPin,
};

const ACTIVITY_COLORS: Record<string, string> = {
  user: '#667eea',
  driver: '#f093fb',
  ride: '#43e97b',
};

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  onPress: () => void;
}

const QuickAction: React.FC<QuickActionProps> = ({ title, description, icon: Icon, onPress }) => (
  <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.actionIcon}>
      <Icon size={20} color="#667eea" />
    </View>
    <View style={styles.actionContent}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionDescription}>{description}</Text>
    </View>
  </TouchableOpacity>
);

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const overviewQuery = trpc.admin.overview.useQuery();
  const overview = overviewQuery.data;
  const isLoadingStats = overviewQuery.isLoading;

  const stats = [
    {
      title: 'Total Users',
      value: overview ? overview.totalUsers.toLocaleString() : '—',
      icon: Users,
      color: '#667eea',
    },
    {
      title: 'Active Drivers',
      value: overview ? overview.activeDrivers.toLocaleString() : '—',
      icon: Car,
      color: '#f093fb',
    },
    {
      title: 'Revenue',
      value: overview ? `₦${overview.totalRevenue.toLocaleString()}` : '—',
      icon: Wallet,
      color: '#4facfe',
    },
    {
      title: 'Rides Today',
      value: overview ? overview.ridesToday.toLocaleString() : '—',
      icon: MapPin,
      color: '#43e97b',
    },
    {
      title: 'Platform Commission',
      value: overview ? `₦${overview.totalPlatformCommission.toLocaleString()}` : '—',
      icon: Wallet,
      color: '#fa709a',
    },
    {
      title: 'Driver Earnings',
      value: overview ? `₦${overview.totalDriverEarnings.toLocaleString()}` : '—',
      icon: Wallet,
      color: '#764ba2',
    },
  ];

  const quickActions = [
    {
      title: 'Manage Users',
      description: 'View and manage user accounts',
      icon: Users,
      onPress: () => console.log('Navigate to users'),
    },
    {
      title: 'Support Tickets',
      description: '23 pending tickets',
      icon: AlertCircle,
      onPress: () => console.log('Navigate to support'),
    },
    {
      title: 'System Status',
      description: 'All systems operational',
      icon: CheckCircle,
      onPress: () => console.log('Navigate to system status'),
    },
    {
      title: 'Analytics',
      description: 'View detailed reports',
      icon: Activity,
      onPress: () => console.log('Navigate to analytics'),
    },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={[styles.header, { paddingTop: insets.top + 32 }]}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <Text style={styles.headerSubtitle}>Real-time overview of your platform</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <View style={styles.statsGrid}>
            {stats.map((stat) => (
              <StatCard key={stat.title} {...stat} isLoading={isLoadingStats} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <QuickAction key={action.title} {...action} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {overviewQuery.isLoading ? (
            <View style={styles.activityCard}>
              <ShimmerGroup>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[styles.activityItem, i === 2 && { borderBottomWidth: 0 }]}
                  >
                    <Skeleton width={32} height={32} borderRadius={16} style={styles.activitySkeletonIcon} />
                    <View style={styles.activityContent}>
                      <SkeletonLine width="55%" height={14} style={styles.adminSkeletonTone} />
                      <SkeletonLine
                        width="35%"
                        height={11}
                        style={[styles.activitySkeletonSubline, styles.adminSkeletonTone]}
                      />
                    </View>
                  </View>
                ))}
              </ShimmerGroup>
            </View>
          ) : overviewQuery.error ? (
            <View style={styles.activityCard}>
              <Text style={styles.errorText}>
                {overviewQuery.error.message.includes('not configured')
                  ? 'Admin data is not configured on the server yet.'
                  : 'Failed to load recent activity.'}
              </Text>
            </View>
          ) : !overview?.recentActivity.length ? (
            <View style={styles.activityCard}>
              <Text style={styles.activityTime}>No recent activity</Text>
            </View>
          ) : (
            <View style={styles.activityCard}>
              {overview.recentActivity.map((item, index) => {
                const Icon = ACTIVITY_ICONS[item.type] ?? Activity;
                const color = ACTIVITY_COLORS[item.type] ?? '#667eea';
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.activityItem,
                      index === overview.recentActivity.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={styles.activityIcon}>
                      <Icon size={16} color={color} />
                    </View>
                    <View style={styles.activityContent}>
                      <Text style={styles.activityTitle}>{item.title}</Text>
                      <Text style={styles.activityTime}>
                        {item.subtitle} · {formatRelativeTime(item.createdAt)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statGradient: {
    padding: 20,
    minHeight: 120,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  statTitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  activityCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    paddingVertical: 8,
  },
  statSkeleton: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  activitySkeletonIcon: {
    marginRight: 12,
    backgroundColor: '#e5e7eb',
  },
  activitySkeletonSubline: {
    marginTop: 6,
  },
  adminSkeletonTone: {
    backgroundColor: '#e5e7eb',
  },
});