import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronRight, Inbox } from 'lucide-react-native';
import { useTheme } from '@/hooks/useThemeStore';
import { trpc } from '@/lib/trpc';

const CATEGORY_LABELS: Record<string, string> = {
  ride_issue: 'Ride',
  payment_issue: 'Payment',
  account_issue: 'Account',
  safety: 'Safety',
  other: 'Other',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

interface TicketListItem {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

function statusColor(status: string, colors: any): string {
  switch (status) {
    case 'resolved': return colors.success;
    case 'in_progress': return colors.primary;
    case 'closed': return colors.gray;
    default: return colors.warning;
  }
}

export default function MyTicketsScreen() {
  const { colors } = useTheme();
  const { data, isLoading, refetch, isRefetching } = trpc.support.listMyTickets.useQuery();
  const tickets = (data?.tickets ?? []) as TicketListItem[];

  const renderItem = ({ item }: { item: TicketListItem }) => (
    <Pressable
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push({ pathname: '/ticket-detail', params: { ticketId: item.id } })}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={[styles.subject, { color: colors.text }]} numberOfLines={1}>{item.subject}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status, colors) + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor(item.status, colors) }]}>
              {STATUS_LABELS[item.status] ?? item.status}
            </Text>
          </View>
        </View>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {CATEGORY_LABELS[item.category] ?? item.category} · {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <ChevronRight size={20} color={colors.gray} />
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <FlatList
        contentContainerStyle={tickets.length === 0 ? styles.emptyList : styles.list}
        data={tickets}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Inbox size={40} color={colors.gray} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No reports yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Anything you report from the Support screen will show up here so you can follow up on it.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flexGrow: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardContent: {
    flex: 1,
    marginRight: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  subject: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
