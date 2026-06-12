import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Users, Search, Filter, MoreVertical, Car } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';

interface User {
  id: string;
  name: string;
  email: string;
  type: 'rider' | 'driver';
  status: 'active' | 'inactive' | 'suspended';
  joinDate: string;
  totalRides: number;
}

const UserCard: React.FC<{ user: User }> = ({ user }) => (
  <View style={styles.userCard}>
    <View style={styles.userInfo}>
      <View style={styles.userHeader}>
        <Text style={styles.userName}>{user.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(user.status) }]}>
          <Text style={styles.statusText}>{user.status}</Text>
        </View>
      </View>
      <Text style={styles.userEmail}>{user.email}</Text>
      <View style={styles.userMeta}>
        <View style={styles.userType}>
          {user.type === 'driver' ? (
            <Car size={16} color="#667eea" />
          ) : (
            <Users size={16} color="#f093fb" />
          )}
          <Text style={styles.userTypeText}>{user.type}</Text>
        </View>
        <Text style={styles.userStats}>{user.totalRides} rides</Text>
      </View>
    </View>
    <TouchableOpacity style={styles.moreButton}>
      <MoreVertical size={20} color="#6b7280" />
    </TouchableOpacity>
  </View>
);

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return '#10b981';
    case 'inactive': return '#6b7280';
    case 'suspended': return '#ef4444';
    default: return '#6b7280';
  }
};

export default function UsersScreen() {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const usersQuery = trpc.admin.users.useQuery();
  const users: User[] = usersQuery.data?.users ?? [];
  const stats = usersQuery.data?.stats;

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !searchQuery ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      selectedFilter === 'all' ||
      (selectedFilter === 'riders' && user.type === 'rider') ||
      (selectedFilter === 'drivers' && user.type === 'driver') ||
      (selectedFilter === 'active' && user.status === 'active') ||
      (selectedFilter === 'suspended' && user.status === 'suspended');

    return matchesSearch && matchesFilter;
  });

  const filters = [
    { key: 'all', label: 'All Users' },
    { key: 'riders', label: 'Riders' },
    { key: 'drivers', label: 'Drivers' },
    { key: 'active', label: 'Active' },
    { key: 'suspended', label: 'Suspended' },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={[styles.header, { paddingTop: insets.top + 32 }]}>
        <Text style={styles.headerTitle}>User Management</Text>
        <Text style={styles.headerSubtitle}>Manage riders and drivers</Text>
      </LinearGradient>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <Filter size={20} color="#667eea" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterChip,
              selectedFilter === filter.key && styles.filterChipActive
            ]}
            onPress={() => setSelectedFilter(filter.key)}
          >
            <Text style={[
              styles.filterChipText,
              selectedFilter === filter.key && styles.filterChipTextActive
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats ? stats.totalUsers.toLocaleString() : '—'}</Text>
            <Text style={styles.statLabel}>Total Users</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats ? stats.activeDrivers.toLocaleString() : '—'}</Text>
            <Text style={styles.statLabel}>Active Drivers</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats ? stats.totalRiders.toLocaleString() : '—'}</Text>
            <Text style={styles.statLabel}>Riders</Text>
          </View>
        </View>

        {usersQuery.isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#667eea" />
          </View>
        ) : usersQuery.error ? (
          <View style={styles.centerState}>
            <Text style={styles.errorText}>
              {usersQuery.error.message.includes('not configured')
                ? 'Admin data is not configured on the server yet.'
                : 'Failed to load users.'}
            </Text>
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.statLabel}>No users found</Text>
          </View>
        ) : (
          <View style={styles.usersList}>
            {filteredUsers.map((user) => (
              <UserCard key={`${user.type}-${user.id}`} user={user} />
            ))}
          </View>
        )}
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
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  filtersContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  filterChipText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  usersList: {
    paddingBottom: 24,
  },
  centerState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  userCard: {
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
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase',
  },
  userEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userType: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userTypeText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  userStats: {
    fontSize: 12,
    color: '#6b7280',
  },
  moreButton: {
    padding: 8,
  },
});