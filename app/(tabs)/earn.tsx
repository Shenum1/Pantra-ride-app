import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Gift,
  Star,
  CheckCircle,
  TrendingUp,
  ExternalLink,
  Youtube,
  Share2,
} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuthStore';
import { usePoints } from '@/hooks/usePointsStore';
import { useTheme } from '@/hooks/useThemeStore';
import { RewardTask, RewardsService } from '@/lib/rewards-service';

export default function EarnScreen() {
  const { user } = useAuth();
  const { balance, balanceNGN, tasks, completedTaskIds, loadPoints, isLoading } = usePoints();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const styles = getStyles(colors);

  useEffect(() => {
    if (user?.id && user.id !== 'test-rider') {
      loadPoints(user.id);
    }
  }, [user?.id]);

  const availableTasks = tasks.filter(t => !completedTaskIds.includes(t.id));
  const completedTasks = tasks.filter(t => completedTaskIds.includes(t.id));

  const renderTaskCard = (task: RewardTask) => (
    <TouchableOpacity
      key={task.id}
      style={styles.taskCard}
      onPress={() => router.push({ pathname: '/task-detail', params: { taskId: task.id } })}
    >
      <View style={styles.taskHeader}>
        <View style={styles.taskIconContainer}>
          {task.type === 'youtube_video'
            ? <Youtube size={20} color="#FF0000" />
            : <Share2 size={20} color={colors.primary} />}
        </View>
        <View style={styles.taskInfo}>
          <Text style={styles.taskTitle}>{task.title}</Text>
          <Text style={styles.taskDescription}>{task.description}</Text>
          <View style={styles.taskMeta}>
            <View style={styles.taskMetaItem}>
              <Star size={14} color={colors.primary} />
              <Text style={styles.taskPoints}>
                +{task.pointsReward} pts (₦{RewardsService.pointsToNGN(task.pointsReward).toLocaleString()})
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.taskAction}>
          <ExternalLink size={20} color={colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Text style={{ color: colors.text }}>Loading your earning opportunities...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Earn Free Rides',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text
        }}
      />

      <View style={{ paddingTop: insets.top }} />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Points Summary */}
        <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <View style={styles.summaryHeader}>
            <Gift size={24} color={colors.primary} />
            <Text style={[styles.summaryTitle, { color: colors.text }]}>Your Points</Text>
          </View>

          <View style={styles.pointsContainer}>
            <View style={styles.pointsItem}>
              <Text style={[styles.pointsValue, { color: colors.primary }]}>{balance}</Text>
              <Text style={[styles.pointsLabel, { color: colors.textSecondary }]}>Points Balance</Text>
            </View>
            <View style={styles.pointsItem}>
              <Text style={[styles.pointsValue, { color: colors.primary }]}>₦{balanceNGN.toLocaleString()}</Text>
              <Text style={[styles.pointsLabel, { color: colors.textSecondary }]}>Ride Credit Value</Text>
            </View>
            <View style={styles.pointsItem}>
              <Text style={[styles.pointsValue, { color: colors.primary }]}>{completedTasks.length}</Text>
              <Text style={[styles.pointsLabel, { color: colors.textSecondary }]}>Tasks Done</Text>
            </View>
          </View>

          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            Apply your points as ride credit at checkout on your next booking.
          </Text>
        </View>

        {/* Available Tasks */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>
              Available Tasks ({availableTasks.length})
            </Text>
          </View>

          {availableTasks.length > 0 ? (
            availableTasks.map(renderTaskCard)
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No tasks available right now. Check back later!
              </Text>
            </View>
          )}
        </View>

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <CheckCircle size={20} color={colors.success} />
              <Text style={styles.sectionTitle}>
                Completed ({completedTasks.length})
              </Text>
            </View>

            {completedTasks.slice(0, 3).map((task) => (
              <View key={task.id} style={[styles.taskCard, styles.completedTaskCard]}>
                <View style={styles.taskHeader}>
                  <View style={styles.taskIconContainer}>
                    {task.type === 'youtube_video'
                      ? <Youtube size={20} color="#FF0000" />
                      : <Share2 size={20} color={colors.primary} />}
                  </View>
                  <View style={styles.taskInfo}>
                    <Text style={[styles.taskTitle, styles.completedTaskTitle]}>
                      {task.title}
                    </Text>
                  </View>
                  <View style={styles.taskAction}>
                    <CheckCircle size={20} color={colors.success} />
                  </View>
                </View>
              </View>
            ))}

            {completedTasks.length > 3 && (
              <TouchableOpacity
                style={styles.viewMoreButton}
                onPress={() => router.push('/earn-history')}
              >
                <Text style={styles.viewMoreText}>
                  View all {completedTasks.length} completed tasks
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  summaryCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  pointsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  pointsItem: {
    alignItems: 'center',
  },
  pointsValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  pointsLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  hintText: {
    fontSize: 12,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: colors.text,
  },
  taskCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  completedTaskCard: {
    opacity: 0.7,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  taskIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  completedTaskTitle: {
    textDecorationLine: 'line-through',
  },
  taskDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  taskPoints: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },
  taskAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  viewMoreButton: {
    padding: 12,
    alignItems: 'center',
  },
  viewMoreText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
});
