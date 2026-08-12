import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import {
  Wallet,
  MapPin,
  Clock,
  TrendingUp,
  ArrowLeft,
  Plus,
  CheckCircle,
  Star,
} from 'lucide-react-native';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useDriverStore } from '@/hooks/useDriverStore';

type GoalType = 'earnings' | 'trips' | 'hours' | 'rating';

interface GoalDefinition {
  id: string;
  title: string;
  description: string;
  type: GoalType;
  target: number;
  deadline: string;
  unit: string;
}

const GOAL_TYPE_CONFIG: Record<GoalType, { icon: (color: string) => React.ReactNode; color: string; unit: string }> = {
  earnings: { icon: (color) => <Wallet size={24} color={color} />, color: '#4CAF50', unit: '₦' },
  trips: { icon: (color) => <MapPin size={24} color={color} />, color: '#2196F3', unit: '' },
  hours: { icon: (color) => <Clock size={24} color={color} />, color: '#FF9800', unit: 'h' },
  rating: { icon: (color) => <TrendingUp size={24} color={color} />, color: '#9C27B0', unit: '' },
};

const DEFAULT_GOALS: GoalDefinition[] = [
  {
    id: 'weekly-earnings',
    title: 'Weekly Earnings',
    description: 'Earn ₦1,000 this week',
    type: 'earnings',
    target: 1000,
    deadline: 'This week',
    unit: '₦',
  },
  {
    id: 'total-trips',
    title: 'Trip Milestone',
    description: 'Complete 200 trips',
    type: 'trips',
    target: 200,
    deadline: 'Ongoing',
    unit: '',
  },
  {
    id: 'online-hours',
    title: 'Online Hours',
    description: 'Spend 8 hours online',
    type: 'hours',
    target: 8,
    deadline: 'Ongoing',
    unit: 'h',
  },
  {
    id: 'rating-goal',
    title: 'Rating Goal',
    description: 'Maintain 4.9+ rating',
    type: 'rating',
    target: 4.9,
    deadline: 'Ongoing',
    unit: '',
  },
];

export default function DriverGoals() {
  const { stats } = useDriverStore();
  const [customGoals, setCustomGoals] = useState<GoalDefinition[]>([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    target: '',
    deadline: '',
    type: 'earnings' as GoalType,
  });

  const getCurrentForType = (type: GoalType): number => {
    switch (type) {
      case 'earnings':
        return stats?.weekEarnings ?? 0;
      case 'trips':
        return stats?.totalRides ?? 0;
      case 'hours':
        return stats?.onlineHours ?? 0;
      case 'rating':
        return stats?.averageRating ?? 0;
    }
  };

  const goals = useMemo(() => [...DEFAULT_GOALS, ...customGoals], [customGoals]);

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return Colors.light.success;
    if (percentage >= 75) return '#4CAF50';
    if (percentage >= 50) return '#FF9800';
    return '#FF5722';
  };

  const handleAddGoal = () => {
    if (!newGoal.title || !newGoal.target || !newGoal.deadline) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const config = GOAL_TYPE_CONFIG[newGoal.type];

    const goal: GoalDefinition = {
      id: Date.now().toString(),
      title: newGoal.title,
      description: `${newGoal.type === 'earnings' ? 'Earn' : newGoal.type === 'trips' ? 'Complete' : newGoal.type === 'hours' ? 'Drive' : 'Achieve'} ${newGoal.target}${config.unit}`,
      type: newGoal.type,
      target: parseFloat(newGoal.target),
      deadline: newGoal.deadline,
      unit: config.unit,
    };

    setCustomGoals(prev => [...prev, goal]);
    setNewGoal({ title: '', target: '', deadline: '', type: 'earnings' });
    setShowAddGoal(false);
  };

  const GoalCard = ({ goal }: { goal: GoalDefinition }) => {
    const config = GOAL_TYPE_CONFIG[goal.type];
    const current = getCurrentForType(goal.type);
    const completed = current >= goal.target;
    const percentage = getProgressPercentage(current, goal.target);
    const progressColor = getProgressColor(percentage);

    return (
      <View style={[styles.goalCard, completed && styles.completedCard]}>
        <View style={styles.goalHeader}>
          <View style={[styles.goalIcon, { backgroundColor: config.color + '20' }]}>
            {config.icon(config.color)}
          </View>
          <View style={styles.goalInfo}>
            <Text style={[styles.goalTitle, completed && styles.completedText]}>
              {goal.title}
            </Text>
            <Text style={styles.goalDescription}>{goal.description}</Text>
            <Text style={styles.goalDeadline}>{goal.deadline}</Text>
          </View>
          {completed && (
            <CheckCircle size={24} color={Colors.light.success} />
          )}
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <View style={styles.progressTextRow}>
              {goal.type === 'rating' && (
                <Star size={12} fill={Colors.light.warning} color={Colors.light.warning} />
              )}
              <Text style={styles.progressText}>
                {goal.unit}{current.toFixed(goal.type === 'rating' ? 1 : 0)} / {goal.unit}{goal.target.toFixed(goal.type === 'rating' ? 1 : 0)}
              </Text>
            </View>
            <Text style={[styles.percentageText, { color: progressColor }]}>
              {percentage.toFixed(0)}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${percentage}%`,
                  backgroundColor: progressColor
                }
              ]}
            />
          </View>
        </View>
      </View>
    );
  };

  const AddGoalForm = () => (
    <View style={styles.addGoalForm}>
      <Text style={styles.formTitle}>Add New Goal</Text>

      <TextInput
        style={styles.input}
        placeholder="Goal title"
        value={newGoal.title}
        onChangeText={(text) => setNewGoal({ ...newGoal, title: text })}
      />

      <View style={styles.typeSelector}>
        {(['earnings', 'trips', 'hours', 'rating'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.typeButton,
              newGoal.type === type && styles.selectedType
            ]}
            onPress={() => setNewGoal({ ...newGoal, type })}
          >
            <Text style={[
              styles.typeText,
              newGoal.type === type && styles.selectedTypeText
            ]}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder="Target amount"
        value={newGoal.target}
        onChangeText={(text) => setNewGoal({ ...newGoal, target: text })}
        keyboardType="numeric"
      />

      <TextInput
        style={styles.input}
        placeholder="Deadline (e.g., Dec 31, 2024)"
        value={newGoal.deadline}
        onChangeText={(text) => setNewGoal({ ...newGoal, deadline: text })}
      />

      <View style={styles.formButtons}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => setShowAddGoal(false)}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddGoal}
        >
          <Text style={styles.addButtonText}>Add Goal</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const completedCount = goals.filter(g => getCurrentForType(g.type) >= g.target).length;
  const avgProgress = goals.length > 0
    ? Math.round(goals.reduce((acc, goal) => acc + getProgressPercentage(getCurrentForType(goal.type), goal.target), 0) / goals.length)
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Goals</Text>
        <TouchableOpacity
          style={styles.addGoalButton}
          onPress={() => setShowAddGoal(true)}
        >
          <Plus size={24} color={Colors.light.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{completedCount}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{goals.length - completedCount}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{avgProgress}%</Text>
          <Text style={styles.statLabel}>Avg Progress</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {showAddGoal && <AddGoalForm />}

        {goals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  addGoalButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.light.white,
    paddingVertical: 20,
    marginBottom: 10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  goalCard: {
    backgroundColor: Colors.light.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  completedCard: {
    borderWidth: 2,
    borderColor: Colors.light.success,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  goalIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  goalInfo: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 4,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: Colors.light.textSecondary,
  },
  goalDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  goalDeadline: {
    fontSize: 12,
    color: Colors.light.gray,
  },
  progressSection: {
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  percentageText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.light.lightGray,
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  addGoalForm: {
    backgroundColor: Colors.light.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginHorizontal: 2,
    alignItems: 'center',
  },
  selectedType: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  typeText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  selectedTypeText: {
    color: Colors.light.white,
    fontWeight: '600',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  addButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
  },
  addButtonText: {
    color: Colors.light.white,
    fontWeight: '600',
  },
});
