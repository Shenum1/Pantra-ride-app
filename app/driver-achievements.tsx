import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import {
  Star,
  Award,
  Trophy,
  Target,
  Zap,
  Moon,
  ArrowLeft,
} from 'lucide-react-native';
import { router } from 'expo-router';
import Colors from '@/constants/colors';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  earned: boolean;
  progress?: number;
  total?: number;
  color: string;
  earnedDate?: string;
  reward?: string;
}

export default function DriverAchievements() {
  const achievements: Achievement[] = [
    {
      id: '1',
      title: 'First Ride',
      description: 'Complete your first ride',
      icon: <Star size={24} color="#FFD700" />,
      earned: true,
      color: '#FFD700',
      earnedDate: 'Jan 15, 2022',
      reward: '$5 Bonus',
    },
    {
      id: '2',
      title: 'Century Club',
      description: 'Complete 100 rides',
      icon: <Trophy size={24} color="#FF9800" />,
      earned: true,
      color: '#FF9800',
      earnedDate: 'Mar 22, 2022',
      reward: '$25 Bonus',
    },
    {
      id: '3',
      title: 'Speed Demon',
      description: 'Complete 10 rides in one day',
      icon: <Zap size={24} color="#2196F3" />,
      earned: true,
      color: '#2196F3',
      earnedDate: 'Apr 8, 2022',
      reward: '$15 Bonus',
    },
    {
      id: '4',
      title: 'Perfect Rating',
      description: 'Maintain 5.0 rating for 50 rides',
      icon: <Award size={24} color="#4CAF50" />,
      earned: false,
      progress: 32,
      total: 50,
      color: '#4CAF50',
      reward: '$50 Bonus',
    },
    {
      id: '5',
      title: 'Night Owl',
      description: 'Complete 25 rides after midnight',
      icon: <Moon size={24} color="#9C27B0" />,
      earned: false,
      progress: 18,
      total: 25,
      color: '#9C27B0',
      reward: '$30 Bonus',
    },
    {
      id: '6',
      title: 'Thousand Club',
      description: 'Complete 1000 rides',
      icon: <Target size={24} color="#FF5722" />,
      earned: true,
      color: '#FF5722',
      earnedDate: 'Nov 12, 2023',
      reward: '$100 Bonus',
    },
  ];

  const AchievementCard = ({ achievement }: { achievement: Achievement }) => (
    <View style={[
      styles.achievementCard,
      !achievement.earned && styles.lockedCard
    ]}>
      <View style={styles.cardHeader}>
        <View style={[
          styles.iconContainer,
          { backgroundColor: achievement.earned ? achievement.color : Colors.light.lightGray }
        ]}>
          {achievement.icon}
        </View>
        <View style={styles.cardContent}>
          <Text style={[
            styles.achievementTitle,
            !achievement.earned && styles.lockedText
          ]}>
            {achievement.title}
          </Text>
          <Text style={[
            styles.achievementDescription,
            !achievement.earned && styles.lockedText
          ]}>
            {achievement.description}
          </Text>
          {achievement.reward && (
            <Text style={styles.rewardText}>Reward: {achievement.reward}</Text>
          )}
        </View>
      </View>
      
      {achievement.earned ? (
        <View style={styles.earnedContainer}>
          <Text style={styles.earnedText}>✓ Earned</Text>
          {achievement.earnedDate && (
            <Text style={styles.earnedDate}>{achievement.earnedDate}</Text>
          )}
        </View>
      ) : (
        achievement.progress && achievement.total && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${(achievement.progress / achievement.total) * 100}%`,
                    backgroundColor: achievement.color 
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {achievement.progress}/{achievement.total} completed
            </Text>
          </View>
        )
      )}
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
        <Text style={styles.headerTitle}>Achievements</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {achievements.filter(a => a.earned).length}
          </Text>
          <Text style={styles.statLabel}>Earned</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {achievements.length - achievements.filter(a => a.earned).length}
          </Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{achievements.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Achievements List */}
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {achievements.map((achievement) => (
          <AchievementCard key={achievement.id} achievement={achievement} />
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
  placeholder: {
    width: 40,
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
  achievementCard: {
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
  lockedCard: {
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  rewardText: {
    fontSize: 12,
    color: Colors.light.success,
    fontWeight: '600',
  },
  lockedText: {
    color: Colors.light.gray,
  },
  earnedContainer: {
    alignItems: 'center',
  },
  earnedText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.success,
    marginBottom: 4,
  },
  earnedDate: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.light.lightGray,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});