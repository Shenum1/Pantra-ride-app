import React, { useState } from 'react';
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
  DollarSign,
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

interface Goal {
  id: string;
  title: string;
  description: string;
  type: 'earnings' | 'trips' | 'hours' | 'rating';
  target: number;
  current: number;
  deadline: string;
  icon: React.ReactNode;
  color: string;
  unit: string;
  completed: boolean;
}

export default function DriverGoals() {
  const [goals, setGoals] = useState<Goal[]>([
    {
      id: '1',
      title: 'Weekly Earnings',
      description: 'Earn ₦1,000 this week',
      type: 'earnings',
      target: 1000,
      current: 892.30,
      deadline: 'Dec 15, 2024',
      icon: <DollarSign size={24} color="#4CAF50" />,
      color: '#4CAF50',
      unit: '₦',
      completed: false,
    },
    {
      id: '2',
      title: 'Monthly Trips',
      description: 'Complete 200 trips this month',
      type: 'trips',
      target: 200,
      current: 156,
      deadline: 'Dec 31, 2024',
      icon: <MapPin size={24} color="#2196F3" />,
      color: '#2196F3',
      unit: '',
      completed: false,
    },
    {
      id: '3',
      title: 'Daily Hours',
      description: 'Drive 8 hours today',
      type: 'hours',
      target: 8,
      current: 8,
      deadline: 'Today',
      icon: <Clock size={24} color="#FF9800" />,
      color: '#FF9800',
      unit: 'h',
      completed: true,
    },
    {
      id: '4',
      title: 'Rating Goal',
      description: 'Maintain 4.9+ rating',
      type: 'rating',
      target: 4.9,
      current: 4.8,
      deadline: 'Ongoing',
      icon: <TrendingUp size={24} color="#9C27B0" />,
      color: '#9C27B0',
      unit: '',
      completed: false,
    },
  ]);

  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    target: '',
    deadline: '',
    type: 'earnings' as Goal['type'],
  });

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

    const goalConfig = {
      earnings: { icon: <DollarSign size={24} color="#4CAF50" />, color: '#4CAF50', unit: '₦' },
      trips: { icon: <MapPin size={24} color="#2196F3" />, color: '#2196F3', unit: '' },
      hours: { icon: <Clock size={24} color="#FF9800" />, color: '#FF9800', unit: 'h' },
      rating: { icon: <TrendingUp size={24} color="#9C27B0" />, color: '#9C27B0', unit: '' },
    };

    const config = goalConfig[newGoal.type];
    
    const goal: Goal = {
      id: Date.now().toString(),
      title: newGoal.title,
      description: `${newGoal.type === 'earnings' ? 'Earn' : newGoal.type === 'trips' ? 'Complete' : newGoal.type === 'hours' ? 'Drive' : 'Achieve'} ${newGoal.target}${config.unit}`,
      type: newGoal.type,
      target: parseFloat(newGoal.target),
      current: 0,
      deadline: newGoal.deadline,
      icon: config.icon,
      color: config.color,
      unit: config.unit,
      completed: false,
    };

    setGoals([...goals, goal]);
    setNewGoal({ title: '', target: '', deadline: '', type: 'earnings' });
    setShowAddGoal(false);
  };

  const GoalCard = ({ goal }: { goal: Goal }) => {
    const percentage = getProgressPercentage(goal.current, goal.target);
    const progressColor = getProgressColor(percentage);

    return (
      <View style={[styles.goalCard, goal.completed && styles.completedCard]}>
        <View style={styles.goalHeader}>
          <View style={[styles.goalIcon, { backgroundColor: goal.color + '20' }]}>
            {goal.icon}
          </View>
          <View style={styles.goalInfo}>
            <Text style={[styles.goalTitle, goal.completed && styles.completedText]}>
              {goal.title}
            </Text>
            <Text style={styles.goalDescription}>{goal.description}</Text>
            <Text style={styles.goalDeadline}>Due: {goal.deadline}</Text>
          </View>
          {goal.completed && (
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
                {goal.unit}{goal.current.toFixed(goal.type === 'rating' ? 1 : 0)} / {goal.unit}{goal.target.toFixed(goal.type === 'rating' ? 1 : 0)}
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
          <Text style={styles.statNumber}>
            {goals.filter(g => g.completed).length}
          </Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {goals.filter(g => !g.completed).length}
          </Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {Math.round(goals.reduce((acc, goal) => acc + getProgressPercentage(goal.current, goal.target), 0) / goals.length)}%
          </Text>
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