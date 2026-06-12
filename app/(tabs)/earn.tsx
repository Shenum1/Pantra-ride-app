import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Platform
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Gift,
  Star,
  Clock,
  ExternalLink,
  CheckCircle,
  TrendingUp,
  Award,
  Target,
  ClipboardList,
  Film,
  Smartphone,
  MessageCircle,
  Users
} from 'lucide-react-native';
import EarnTaskIcon from '@/components/EarnTaskIcon';
import { useEarn } from '@/hooks/useEarnStore';
import { useTheme } from '@/hooks/useThemeStore';
import Button from '@/components/Button';
import { EarnTask } from '@/types';

export default function EarnScreen() {
  const {
    userEarnings,
    getAvailableTasks,
    getCompletedTasks,
    completeTask,
    redeemFreeRide,
    canRedeemFreeRide,
    getDiscountTier,
    pointsToRideConversion,
    isLoading
  } = useEarn();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  const styles = getStyles(colors);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [completingTask, setCompletingTask] = useState<string | null>(null);

  const availableTasks = getAvailableTasks();
  const completedTasks = getCompletedTasks();
  const discountTier = getDiscountTier();

  const categories = [
    { id: 'all', name: 'All Tasks', icon: ClipboardList },
    { id: 'entertainment', name: 'Watch', icon: Film },
    { id: 'social', name: 'Social', icon: Smartphone },
    { id: 'engagement', name: 'Engage', icon: MessageCircle },
    { id: 'referral', name: 'Refer', icon: Users }
  ];

  const filteredTasks = selectedCategory === 'all' 
    ? availableTasks 
    : availableTasks.filter(task => task.category === selectedCategory);

  const handleTaskPress = async (task: EarnTask) => {
    if (task.url) {
      try {
        if (Platform.OS === 'web') {
          // On web, open in new tab
          window.open(task.url, '_blank');
          
          // Show completion dialog after opening external link
          setTimeout(() => {
            Alert.alert(
              'Task Completed?',
              `Did you complete: ${task.title}?`,
              [
                { text: 'Not Yet', style: 'cancel' },
                { 
                  text: 'Yes, I Did!', 
                  onPress: () => handleCompleteTask(task.id),
                  style: 'default'
                }
              ]
            );
          }, 2000);
        } else {
          // On mobile, use Linking
          const supported = await Linking.canOpenURL(task.url);
          if (supported) {
            await Linking.openURL(task.url);
            
            // Show completion dialog after opening external link
            setTimeout(() => {
              Alert.alert(
                'Task Completed?',
                `Did you complete: ${task.title}?`,
                [
                  { text: 'Not Yet', style: 'cancel' },
                  { 
                    text: 'Yes, I Did!', 
                    onPress: () => handleCompleteTask(task.id),
                    style: 'default'
                  }
                ]
              );
            }, 2000);
          } else {
            Alert.alert(
              'Link Not Supported', 
              'This link cannot be opened on your device. Please try accessing it through a web browser.',
              [{ text: 'OK' }]
            );
          }
        }
      } catch (error) {
        console.error('Error opening URL:', error);
        Alert.alert(
          'Error', 
          'Could not open the link. Please check your internet connection and try again.',
          [{ text: 'OK' }]
        );
      }
    } else {
      // For tasks without URLs (like daily check-in)
      handleCompleteTask(task.id);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      setCompletingTask(taskId);
      await completeTask(taskId);
      
      const task = availableTasks.find(t => t.id === taskId);
      if (task) {
        Alert.alert(
          'Congratulations!',
          `You earned ${task.points} points for completing \"${task.title}\"!`,
          [{ text: 'Awesome!', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Error completing task:', error);
      Alert.alert('Error', 'Could not complete task. Please try again.');
    } finally {
      setCompletingTask(null);
    }
  };

  const handleRedeemFreeRide = async () => {
    try {
      Alert.alert(
        'Redeem Free Ride',
        `Use ${pointsToRideConversion.freeRidePoints} points for a completely free ride?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Redeem',
            onPress: async () => {
              try {
                await redeemFreeRide();
                Alert.alert(
                  'Success!',
                  'Your free ride has been added to your account. Use it on your next booking!',
                  [{ text: 'Great!', style: 'default' }]
                );
              } catch {
                Alert.alert('Error', 'Could not redeem free ride. Please try again.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error redeeming free ride:', error);
    }
  };

  const renderTaskCard = (task: EarnTask) => (
    <TouchableOpacity
      key={task.id}
      style={styles.taskCard}
      onPress={() => handleTaskPress(task)}
      disabled={completingTask === task.id}
    >
      <View style={styles.taskHeader}>
        <View style={styles.taskIconContainer}>
          <EarnTaskIcon icon={task.icon} size={20} color={colors.primary} />
        </View>
        <View style={styles.taskInfo}>
          <Text style={styles.taskTitle}>{task.title}</Text>
          <Text style={styles.taskDescription}>{task.description}</Text>
          <View style={styles.taskMeta}>
            <View style={styles.taskMetaItem}>
              <Star size={14} color={colors.primary} />
              <Text style={styles.taskPoints}>{task.points} pts</Text>
            </View>
            <View style={styles.taskMetaItem}>
              <Clock size={14} color={colors.text} />
              <Text style={styles.taskTime}>{task.estimatedTime} min</Text>
            </View>
          </View>
        </View>
        <View style={styles.taskAction}>
          {task.url && <ExternalLink size={20} color={colors.primary} />}
          {completingTask === task.id && (
            <Text style={styles.completingText}>...</Text>
          )}
        </View>
      </View>
      
      {task.requirements && (
        <View style={styles.requirements}>
          <Text style={styles.requirementsTitle}>Requirements:</Text>
          {task.requirements.map((req, index) => (
            <Text key={index} style={styles.requirement}>• {req}</Text>
          ))}
        </View>
      )}
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
      
      {/* Safe area padding */}
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
              <Text style={[styles.pointsValue, { color: colors.primary }]}>{userEarnings.availablePoints}</Text>
              <Text style={[styles.pointsLabel, { color: colors.textSecondary }]}>Available</Text>
            </View>
            <View style={styles.pointsItem}>
              <Text style={[styles.pointsValue, { color: colors.primary }]}>{userEarnings.totalPoints}</Text>
              <Text style={[styles.pointsLabel, { color: colors.textSecondary }]}>Total Earned</Text>
            </View>
            <View style={styles.pointsItem}>
              <Text style={[styles.pointsValue, { color: colors.primary }]}>{userEarnings.freeRidesEarned}</Text>
              <Text style={[styles.pointsLabel, { color: colors.textSecondary }]}>Free Rides</Text>
            </View>
          </View>

          {/* Progress to Free Ride */}
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Target size={16} color={colors.primary} />
              <Text style={styles.progressTitle}>Progress to Free Ride</Text>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${Math.min(
                      (userEarnings.availablePoints / pointsToRideConversion.freeRidePoints) * 100, 
                      100
                    )}%` 
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {userEarnings.availablePoints} / {pointsToRideConversion.freeRidePoints} points
            </Text>
          </View>

          {/* Redeem Button */}
          <Button
            title={canRedeemFreeRide() ? 'Redeem Free Ride' : `Need ${pointsToRideConversion.freeRidePoints - userEarnings.availablePoints} more points`}
            onPress={handleRedeemFreeRide}
            disabled={!canRedeemFreeRide()}
            style={[
              styles.redeemButton,
              !canRedeemFreeRide() && styles.redeemButtonDisabled
            ]}
          />

          {/* Current Discount */}
          {discountTier && (
            <View style={styles.discountBadge}>
              <Award size={16} color={colors.primary} />
              <Text style={styles.discountText}>
                You have {discountTier.discount}% discount available!
              </Text>
            </View>
          )}
        </View>

        {/* Category Filter */}
        <View style={styles.categoriesContainer}>
          <View style={styles.categoriesRow}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryChip,
                  selectedCategory === category.id && styles.categoryChipActive
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <category.icon
                  size={16}
                  color={selectedCategory === category.id ? 'white' : colors.text}
                  style={styles.categoryIcon}
                />
                <Text style={[
                  styles.categoryText,
                  selectedCategory === category.id && styles.categoryTextActive
                ]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Available Tasks */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>
              Available Tasks ({filteredTasks.length})
            </Text>
          </View>
          
          {filteredTasks.length > 0 ? (
            filteredTasks.map(renderTaskCard)
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {selectedCategory === 'all' 
                  ? 'No tasks available right now. Check back later!'
                  : 'No tasks in this category. Try another category!'
                }
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
                    <EarnTaskIcon icon={task.icon} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.taskInfo}>
                    <Text style={[styles.taskTitle, styles.completedTaskTitle]}>
                      {task.title}
                    </Text>
                    <Text style={styles.taskDescription}>
                      Completed {task.completedAt?.toLocaleDateString()}
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
    marginBottom: 20,
  },
  pointsItem: {
    alignItems: 'center',
  },
  pointsValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  pointsLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
    color: colors.text,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  redeemButton: {
    marginTop: 8,
  },
  redeemButtonDisabled: {
    opacity: 0.6,
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    padding: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  discountText: {
    fontSize: 12,
    color: colors.primary,
    marginLeft: 6,
    fontWeight: '500',
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
    minWidth: '18%',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
  },
  categoryIcon: {
    marginRight: 6,
  },
  categoryText: {
    fontSize: 14,
    color: colors.text,
  },
  categoryTextActive: {
    color: 'white',
    fontWeight: '500',
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
  taskTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  taskAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
  },
  completingText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  requirements: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  requirementsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  requirement: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
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