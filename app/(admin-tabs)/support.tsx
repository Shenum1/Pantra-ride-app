import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';


interface SupportTicket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  user: string;
  createdAt: string;
  category: string;
}

const TicketCard: React.FC<{ ticket: SupportTicket }> = ({ ticket }) => (
  <View style={styles.ticketCard}>
    <View style={styles.ticketHeader}>
      <View style={styles.ticketInfo}>
        <Text style={styles.ticketTitle}>{ticket.title}</Text>
        <Text style={styles.ticketUser}>by {ticket.user}</Text>
      </View>
      <View style={styles.ticketBadges}>
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(ticket.priority) }]}>
          <Text style={styles.badgeText}>{ticket.priority}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ticket.status) }]}>
          <Text style={styles.badgeText}>{ticket.status}</Text>
        </View>
      </View>
    </View>
    <Text style={styles.ticketDescription} numberOfLines={2}>
      {ticket.description}
    </Text>
    <View style={styles.ticketFooter}>
      <Text style={styles.ticketCategory}>{ticket.category}</Text>
      <Text style={styles.ticketTime}>{ticket.createdAt}</Text>
    </View>
  </View>
);

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return '#ef4444';
    case 'high': return '#f97316';
    case 'medium': return '#eab308';
    case 'low': return '#10b981';
    default: return '#6b7280';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'open': return '#3b82f6';
    case 'in-progress': return '#f59e0b';
    case 'resolved': return '#10b981';
    case 'closed': return '#6b7280';
    default: return '#6b7280';
  }
};

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const tickets: SupportTicket[] = [
    {
      id: '1',
      title: 'Payment not processed',
      description: 'My payment was charged but the ride was not confirmed. Need immediate assistance.',
      status: 'open',
      priority: 'high',
      user: 'John Doe',
      createdAt: '2 hours ago',
      category: 'Payment',
    },
    {
      id: '2',
      title: 'Driver was rude',
      description: 'The driver was unprofessional and made inappropriate comments during the ride.',
      status: 'in-progress',
      priority: 'medium',
      user: 'Sarah Wilson',
      createdAt: '5 hours ago',
      category: 'Behavior',
    },
    {
      id: '3',
      title: 'App crashes on startup',
      description: 'The app keeps crashing when I try to open it. Tried reinstalling but issue persists.',
      status: 'resolved',
      priority: 'urgent',
      user: 'Mike Johnson',
      createdAt: '1 day ago',
      category: 'Technical',
    },
  ];

  const filters = [
    { key: 'all', label: 'All Tickets' },
    { key: 'open', label: 'Open' },
    { key: 'in-progress', label: 'In Progress' },
    { key: 'resolved', label: 'Resolved' },
  ];

  const stats = [
    { label: 'Open Tickets', value: '23', color: '#3b82f6' },
    { label: 'In Progress', value: '12', color: '#f59e0b' },
    { label: 'Resolved Today', value: '45', color: '#10b981' },
    { label: 'Avg Response', value: '2.3h', color: '#8b5cf6' },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={[styles.header, { paddingTop: insets.top + 32 }]}>
        <Text style={styles.headerTitle}>Customer Support</Text>
        <Text style={styles.headerSubtitle}>Manage support tickets and issues</Text>
      </LinearGradient>

      <View style={styles.statsContainer}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
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
        <View style={styles.ticketsList}>
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
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
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  statCard: {
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
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
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
  ticketsList: {
    paddingBottom: 24,
  },
  ticketCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  ticketInfo: {
    flex: 1,
    marginRight: 12,
  },
  ticketTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  ticketUser: {
    fontSize: 12,
    color: '#6b7280',
  },
  ticketBadges: {
    alignItems: 'flex-end',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase',
  },
  ticketDescription: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketCategory: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '500',
  },
  ticketTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
});