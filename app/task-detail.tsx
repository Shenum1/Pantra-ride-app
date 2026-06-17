import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  Share,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Youtube, Share2, Star, Clock, CheckCircle } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import Button from '@/components/Button';
import Colors from '@/constants/colors';
import { useTheme } from '@/hooks/useThemeStore';
import { useAuth } from '@/hooks/useAuthStore';
import { usePoints } from '@/hooks/usePointsStore';
import { RewardTask, RewardsService } from '@/lib/rewards-service';

export default function TaskDetailScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { tasks, completedTaskIds, claimReward } = usePoints();
  const { taskId } = useLocalSearchParams<{ taskId: string }>();

  const task: RewardTask | undefined = tasks.find(t => t.id === taskId);

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [canClaim, setCanClaim] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [shareDone, setShareDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isCompleted = task ? completedTaskIds.includes(task.id) : false;
  const minSeconds = task?.minWatchSeconds ?? 120;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = () => {
    const now = Date.now();
    setStartedAt(now);
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - now) / 1000);
      setElapsed(secs);
      if (secs >= minSeconds) {
        setCanClaim(true);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 1000);
  };

  const handleWatchVideo = async () => {
    if (!task?.url) {
      Alert.alert('No link available', 'This task has no video link yet.');
      return;
    }
    try {
      await Linking.openURL(task.url);
      startTimer();
    } catch {
      Alert.alert('Error', 'Could not open the video link.');
    }
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'Check out Pantra Ride — the smartest way to get around Nigeria! Download now and get your first ride.',
      });
      setShareDone(true);
      setCanClaim(true);
    } catch {
      // user dismissed share sheet
    }
  };

  const handleClaim = async () => {
    if (!user?.id || user.id === 'test-rider') {
      Alert.alert('Sign in required', 'Please sign in to claim rewards.');
      return;
    }
    if (!task) return;

    setIsClaiming(true);
    try {
      await claimReward(user.id, task.id, task.pointsReward);
      Toast.show({
        type: 'success',
        text1: `+${task.pointsReward} points earned!`,
        text2: `₦${RewardsService.pointsToNGN(task.pointsReward).toLocaleString()} added to your ride credit`,
        position: 'top',
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not claim reward. Try again.');
    } finally {
      setIsClaiming(false);
    }
  };

  if (!task) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Task' }} />
        <Text style={[styles.notFound, { color: colors.textSecondary }]}>Task not found.</Text>
      </SafeAreaView>
    );
  }

  const remaining = Math.max(0, minSeconds - elapsed);
  const timerLabel = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: task.title }} />

      <View style={styles.content}>
        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: colors.card }]}>
          {task.type === 'youtube_video'
            ? <Youtube size={40} color="#FF0000" />
            : <Share2 size={40} color={Colors.light.primary} />}
        </View>

        {/* Reward badge */}
        <View style={styles.rewardBadge}>
          <Star size={16} color="#FFD700" fill="#FFD700" />
          <Text style={styles.rewardText}>
            +{task.pointsReward} pts = ₦{RewardsService.pointsToNGN(task.pointsReward).toLocaleString()} ride credit
          </Text>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>{task.title}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>{task.description}</Text>

        {/* Already completed */}
        {isCompleted ? (
          <View style={styles.completedBox}>
            <CheckCircle size={24} color={Colors.light.success} />
            <Text style={styles.completedText}>You've already claimed this reward!</Text>
          </View>
        ) : (
          <>
            {/* YouTube flow */}
            {task.type === 'youtube_video' && (
              <>
                {!startedAt ? (
                  <Button title="Watch Video" onPress={handleWatchVideo} style={styles.actionBtn} />
                ) : (
                  <View style={[styles.timerBox, { backgroundColor: colors.card }]}>
                    <Clock size={20} color={canClaim ? Colors.light.success : Colors.light.primary} />
                    <Text style={[styles.timerText, { color: canClaim ? Colors.light.success : colors.text }]}>
                      {canClaim ? 'Ready to claim!' : `Watch for ${timerLabel} more`}
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Social share flow */}
            {task.type === 'social_share' && !shareDone && (
              <Button title="Share App" onPress={handleShareApp} style={styles.actionBtn} />
            )}

            {/* Claim button */}
            {canClaim && (
              <Button
                title={isClaiming ? 'Claiming...' : `Claim ${task.pointsReward} Points`}
                onPress={handleClaim}
                loading={isClaiming}
                disabled={isClaiming}
                style={[styles.actionBtn, styles.claimBtn]}
              />
            )}

            {task.type === 'youtube_video' && minSeconds > 0 && !startedAt && (
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                You'll need to watch for at least {Math.ceil(minSeconds / 60)} minute{minSeconds >= 120 ? 's' : ''} before claiming.
              </Text>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', padding: 24, gap: 16 },
  notFound: { textAlign: 'center', marginTop: 40, fontSize: 16 },

  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },

  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  rewardText: { fontSize: 14, fontWeight: '700', color: '#92660A' },

  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  description: { fontSize: 15, textAlign: 'center', lineHeight: 22 },

  completedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: Colors.light.success + '18',
  },
  completedText: { fontSize: 15, fontWeight: '600', color: Colors.light.success },

  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    width: '100%',
  },
  timerText: { fontSize: 16, fontWeight: '700' },

  actionBtn: { width: '100%', marginTop: 8 },
  claimBtn: { backgroundColor: Colors.light.success },

  hint: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
