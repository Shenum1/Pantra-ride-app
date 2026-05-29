import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Stack } from 'expo-router';
import { 
  CheckCircle,
  TrendingDown,
  TrendingUp,
  Calendar,
  Star,
  Gift
} from 'lucide-react-native';
import { useEarn } from '@/hooks/useEarnStore';
import Colors from '@/constants/colors';

export default function EarnHistoryScreen() {
  const {
    getCompletedTasks,
    transactions,
    userEarnings,
    isLoading
  } = useEarn();

  const [selectedTab, setSelectedTab] = useState<'tasks' | 'transactions'>('tasks');

  const completedTasks = getCompletedTasks();
  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const renderTaskItem = (task: any) => (
    <View key={task.id} style={styles.historyItem}>
      <View style={styles.itemIconContainer}>
        <Text style={styles.itemIcon}>{task.icon}</Text>
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>{task.title}</Text>
        <Text style={styles.itemDescription}>{task.description}</Text>
        <View style={styles.itemMeta}>
          <Calendar size={12} color={Colors.light.textSecondary} />
          <Text style={styles.itemDate}>
            {task.completedAt?.toLocaleDateString()}
          </Text>
        </View>
      </View>
      <View style={styles.itemPoints}>
        <View style={styles.pointsBadge}>
          <Star size={12} color={Colors.light.primary} />
          <Text style={styles.pointsText}>+{task.points}</Text>
        </View>
      </View>
    </View>
  );

  const renderTransactionItem = (transaction: any) => (
    <View key={transaction.id} style={styles.historyItem}>
      <View style={styles.itemIconContainer}>
        {transaction.type === 'earned' ? (
          <TrendingUp size={20} color={Colors.light.success} />
        ) : (
          <TrendingDown size={20} color={Colors.light.error} />
        )}
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>{transaction.description}</Text>
        <View style={styles.itemMeta}>
          <Calendar size={12} color={Colors.light.textSecondary} />
          <Text style={styles.itemDate}>
            {transaction.createdAt.toLocaleDateString()}
          </Text>
        </View>
      </View>
      <View style={styles.itemPoints}>
        <Text style={[
          styles.transactionPoints,
          transaction.type === 'earned' ? styles.earnedPoints : styles.spentPoints
        ]}>
          {transaction.type === 'earned' ? '+' : '-'}{transaction.points}
        </Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading your history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Earning History',
          headerStyle: { backgroundColor: Colors.light.background },
          headerTintColor: Colors.light.text
        }} 
      />

      {/* Summary Stats */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{userEarnings.totalPoints}</Text>
            <Text style={styles.summaryLabel}>Total Earned</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{completedTasks.length}</Text>
            <Text style={styles.summaryLabel}>Tasks Done</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{userEarnings.freeRidesEarned}</Text>
            <Text style={styles.summaryLabel}>Free Rides</Text>
          </View>
        </View>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'tasks' && styles.activeTab
          ]}
          onPress={() => setSelectedTab('tasks')}
        >
          <CheckCircle 
            size={16} 
            color={selectedTab === 'tasks' ? 'white' : Colors.light.textSecondary} 
          />
          <Text style={[
            styles.tabText,
            selectedTab === 'tasks' && styles.activeTabText
          ]}>
            Completed Tasks
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'transactions' && styles.activeTab
          ]}
          onPress={() => setSelectedTab('transactions')}
        >
          <Gift 
            size={16} 
            color={selectedTab === 'transactions' ? 'white' : Colors.light.textSecondary} 
          />
          <Text style={[
            styles.tabText,
            selectedTab === 'transactions' && styles.activeTabText
          ]}>
            Point History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {selectedTab === 'tasks' ? (
          <View style={styles.content}>
            {completedTasks.length > 0 ? (
              completedTasks.map(renderTaskItem)
            ) : (
              <View style={styles.emptyState}>
                <CheckCircle size={48} color={Colors.light.textSecondary} />
                <Text style={styles.emptyStateTitle}>No completed tasks yet</Text>
                <Text style={styles.emptyStateText}>
                  Start completing tasks to see your history here
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.content}>
            {sortedTransactions.length > 0 ? (
              sortedTransactions.map(renderTransactionItem)
            ) : (
              <View style={styles.emptyState}>
                <Gift size={48} color={Colors.light.textSecondary} />
                <Text style={styles.emptyStateTitle}>No transactions yet</Text>
                <Text style={styles.emptyStateText}>
                  Your point earning and spending history will appear here
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: Colors.light.primary,
  },
  tabText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginLeft: 6,
  },
  activeTabText: {
    color: 'white',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  itemIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemIcon: {
    fontSize: 18,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 6,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemDate: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginLeft: 4,
  },
  itemPoints: {
    alignItems: 'flex-end',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.primary,
    marginLeft: 4,
  },
  transactionPoints: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  earnedPoints: {
    color: Colors.light.success,
  },
  spentPoints: {
    color: Colors.light.error,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});