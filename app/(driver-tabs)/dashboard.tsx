import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import {
  TrendingUp,
  Star,
  Clock,
  DollarSign,
  MapPin,
  Award,
  Target,
  Navigation,
  ChevronRight,
  Calendar,
  Users,
} from 'lucide-react-native';
import { router } from 'expo-router';

import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { useDriverStore } from '@/hooks/useDriverStore';

const { width } = Dimensions.get('window');

const DRIVING_VIDEOS = [
  'https://videos.pexels.com/video-files/3044127/3044127-uhd_2560_1440_25fps.mp4',
  'https://videos.pexels.com/video-files/2103099/2103099-uhd_2560_1440_30fps.mp4',
  'https://videos.pexels.com/video-files/3571264/3571264-uhd_2560_1440_30fps.mp4',
];

export default function DriverDashboard() {
  const { driver, toggleOnlineStatus } = useDriverAuth();
  const { driverProfile, stats, earnings } = useDriverStore();
  const player = useVideoPlayer(
    DRIVING_VIDEOS[Math.floor(Math.random() * DRIVING_VIDEOS.length)],
    (p) => { p.loop = true; p.muted = true; p.playbackRate = 0.7; p.play(); }
  );

  const [animatedValue] = useState<Animated.Value>(new Animated.Value(0));
  
  const todayEarnings = stats?.todayEarnings || driverProfile?.earnings?.today || 0;
  const weeklyEarnings = stats?.weekEarnings || driverProfile?.earnings?.thisWeek || 0;
  const monthlyEarnings = stats?.monthEarnings || driverProfile?.earnings?.thisMonth || 0;
  const rating = stats?.averageRating || driver?.rating || 5.0;
  const completedTrips = stats?.totalRides || driverProfile?.totalRides || 0;
  const isOnline = driver?.isOnline || false;
  const totalEarnings = stats?.totalEarnings || 0;
  const onlineHours = stats?.onlineHours || 0;

  const [currentVideoIndex] = useState(() => Math.floor(Math.random() * DRIVING_VIDEOS.length));

  const motivationalQuotes = useMemo(() => [
    "Keep driving towards your goals! 💪",
    "Every trip brings you closer to success 🎯",
    "Great service = Great earnings ⭐",
    "You're making a difference today! 🚗",
    "Stay focused, stay earning 💰",
  ], []);

  const [currentQuote, setCurrentQuote] = useState<string>(motivationalQuotes[0]);



  useEffect(() => {
    const quoteInterval = setInterval(() => {
      const randomQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
      setCurrentQuote(randomQuote);
    }, 5000);

    return () => clearInterval(quoteInterval);
  }, [motivationalQuotes]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();
  }, [animatedValue]);



  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {/* Video Background */}
      {Platform.OS !== 'web' ? (
        <VideoView
          player={player}
          style={styles.videoBackground}
          contentFit="cover"
          nativeControls={false}
        />
      ) : (
        <video
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        >
          <source src={DRIVING_VIDEOS[currentVideoIndex]} type="video/mp4" />
        </video>
      )}

      {/* Dark Overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)']}
        style={styles.overlay}
      />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
          <View style={styles.greetingSection}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.driverName}>{driver?.name?.split(' ')[0] || 'Driver'}! 👋</Text>
          </View>
          <TouchableOpacity 
            style={[styles.statusButton, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]}
            onPress={toggleOnlineStatus}
            activeOpacity={0.8}
          >
            <View style={[styles.onlineIndicator, { opacity: isOnline ? 1 : 0.5 }]} />
            <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Earnings Card */}
        <View style={styles.earningsCard}>
          <View style={styles.earningsHeader}>
            <View>
              <Text style={styles.earningsLabel}>Today&apos;s Earnings</Text>
              <Text style={styles.earningsAmount}>${todayEarnings.toFixed(2)}</Text>
            </View>
            <View style={styles.earningsBadge}>
              <TrendingUp size={16} color="#10B981" strokeWidth={2.5} />
              <Text style={styles.earningsTrend}>{todayEarnings > 0 ? '+' : ''}{((todayEarnings / (todayEarnings + 1)) * 100).toFixed(0)}%</Text>
            </View>
          </View>
          <View style={styles.earningsStats}>
            <View style={styles.earningsStat}>
              <Clock size={14} color="rgba(255,255,255,0.6)" />
              <Text style={styles.earningsStatLabel}>Active Time</Text>
              <Text style={styles.earningsStatValue}>{Math.floor(onlineHours)}h {Math.round((onlineHours % 1) * 60)}m</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.earningsStat}>
              <Navigation size={14} color="rgba(255,255,255,0.6)" />
              <Text style={styles.earningsStatLabel}>Total Earned</Text>
              <Text style={styles.earningsStatValue}>${totalEarnings.toFixed(0)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.earningsStat}>
              <MapPin size={14} color="rgba(255,255,255,0.6)" />
              <Text style={styles.earningsStatLabel}>Trips</Text>
              <Text style={styles.earningsStatValue}>{completedTrips}</Text>
            </View>
          </View>
        </View>

        {/* Motivational Quote */}
        <View style={styles.quoteContainer}>
          <Text style={styles.quote}>{currentQuote}</Text>
        </View>

        {/* Performance Overview */}
        <View style={styles.performanceSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Performance</Text>
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => router.push('/driver-trip-history')}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <ChevronRight size={16} color="#FFD700" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.performanceGrid}>
            <View style={[styles.performanceCard, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
              <View style={styles.performanceIcon}>
                <DollarSign size={20} color="#10B981" strokeWidth={2.5} />
              </View>
              <Text style={styles.performanceValue}>${weeklyEarnings.toFixed(0)}</Text>
              <Text style={styles.performanceLabel}>This Week</Text>
            </View>
            
            <View style={[styles.performanceCard, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
              <View style={styles.performanceIcon}>
                <Calendar size={20} color="#3B82F6" strokeWidth={2.5} />
              </View>
              <Text style={styles.performanceValue}>${monthlyEarnings.toFixed(0)}</Text>
              <Text style={styles.performanceLabel}>This Month</Text>
            </View>
            
            <View style={[styles.performanceCard, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
              <View style={styles.performanceIcon}>
                <Star size={20} color="#F59E0B" strokeWidth={2.5} />
              </View>
              <Text style={styles.performanceValue}>{rating}</Text>
              <Text style={styles.performanceLabel}>Rating</Text>
            </View>
            
            <View style={[styles.performanceCard, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
              <View style={styles.performanceIcon}>
                <Users size={20} color="#8B5CF6" strokeWidth={2.5} />
              </View>
              <Text style={styles.performanceValue}>{driver?.totalRides || 0}</Text>
              <Text style={styles.performanceLabel}>Total Trips</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => router.push('/driver-trip-history')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIconBg, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                <Clock size={22} color="#3B82F6" strokeWidth={2.5} />
              </View>
              <Text style={styles.quickActionTitle}>Trip History</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => router.push('/driver-earnings')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                <DollarSign size={22} color="#10B981" strokeWidth={2.5} />
              </View>
              <Text style={styles.quickActionTitle}>Earnings</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => router.push('/driver-achievements')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIconBg, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                <Award size={22} color="#F59E0B" strokeWidth={2.5} />
              </View>
              <Text style={styles.quickActionTitle}>Achievements</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => router.push('/driver-goals')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIconBg, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
                <Target size={22} color="#8B5CF6" strokeWidth={2.5} />
              </View>
              <Text style={styles.quickActionTitle}>Goals</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Weekly Goal Progress */}
        <View style={styles.goalSection}>
          <Text style={styles.sectionTitle}>Weekly Goal Progress</Text>
          <View style={styles.goalCard}>
            <View style={styles.goalHeader}>
              <Text style={styles.goalTitle}>$1,000 Weekly Target</Text>
              <Text style={styles.goalPercentage}>{Math.round((weeklyEarnings / 1000) * 100)}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min((weeklyEarnings / 1000) * 100, 100)}%` }]} />
            </View>
            <Text style={styles.goalSubtext}>
              {weeklyEarnings >= 1000 ? 'Goal completed! 🎉' : `${(1000 - weeklyEarnings).toFixed(2)} to go`}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  greeting: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.8)',
  },
  driverName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 2,
    color: '#FFFFFF',
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  onlineIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  statusText: {
    fontWeight: '700',
    fontSize: 15,
    color: '#FFFFFF',
  },

  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 10,
  },
  quoteContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  quote: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#FFD700',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#FFFFFF',
  },
  quickActionsSection: {
    marginTop: 30,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    color: '#FFFFFF',
  },
  goalSection: {
    marginTop: 20,
  },
  goalCard: {
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  goalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  goalPercentage: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#4CAF50',
  },
  goalSubtext: {
    fontSize: 14,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  greetingSection: {
    flex: 1,
  },
  earningsCard: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 15,
    padding: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  earningsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  earningsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  earningsTrend: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
  },
  earningsStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  earningsStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  earningsStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  earningsStatValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  performanceSection: {
    marginTop: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 15,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFD700',
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },
  performanceCard: {
    width: (width - 56) / 2,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  performanceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  performanceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  performanceLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  quickActionCard: {
    width: (width - 56) / 2,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  quickActionIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
});