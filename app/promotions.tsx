import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Tag, Check, Star, Youtube, Share2, ChevronRight } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import Colors from '@/constants/colors';
import { usePromotions } from '@/hooks/usePromotionsStore';
import { usePoints } from '@/hooks/usePointsStore';
import { useAuth } from '@/hooks/useAuthStore';
import { RewardTask } from '@/lib/rewards-service';
import Button from '@/components/Button';

export default function PromotionsScreen() {
  const { user } = useAuth();
  const {
    promotions,
    isLoading: promosLoading,
    activePromoCode,
    loadPromotions,
    applyPromoCode,
    markPromoAsUsed,
    clearActivePromo,
  } = usePromotions();
  const {
    balance,
    balanceNGN,
    tasks,
    completedTaskIds,
    isLoading: pointsLoading,
    loadPoints,
  } = usePoints();

  const [promoCode, setPromoCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    loadPromotions();
    if (user?.id && user.id !== 'test-rider') {
      loadPoints(user.id);
    }
  }, [user?.id]);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setIsApplying(true);
    try {
      const result = await applyPromoCode(promoCode.trim());
      if (result.success) {
        Toast.show({ type: 'success', text1: 'Promo applied!', text2: result.message, position: 'top' });
        setPromoCode('');
      } else {
        Alert.alert('Invalid code', result.message);
      }
    } finally {
      setIsApplying(false);
    }
  };

  const handleRemovePromo = () => {
    clearActivePromo();
    Toast.show({ type: 'info', text1: 'Promo removed', position: 'top' });
  };

  const taskIcon = (task: RewardTask) => {
    if (task.type === 'youtube_video') return <Youtube size={20} color="#FF0000" />;
    return <Share2 size={20} color={Colors.light.primary} />;
  };

  const isTaskCompleted = (taskId: string) => completedTaskIds.includes(taskId);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{
        title: 'Promotions & Rewards',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: Colors.light.background },
      }} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Points balance card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceLeft}>
            <Star size={22} color="#FFD700" fill="#FFD700" />
            <View style={styles.balanceTexts}>
              <Text style={styles.balanceLabel}>Your points balance</Text>
              <Text style={styles.balancePoints}>{balance.toLocaleString()} pts</Text>
            </View>
          </View>
          {balance > 0 && (
            <View style={styles.balanceNGN}>
              <Text style={styles.balanceNGNText}>≈ ₦{balanceNGN.toLocaleString()}</Text>
              <Text style={styles.balanceNGNSub}>ride credit</Text>
            </View>
          )}
        </View>

        {/* Earn points — tasks */}
        <Text style={styles.sectionTitle}>Earn points</Text>
        {pointsLoading ? (
          <ActivityIndicator style={styles.loader} color={Colors.light.primary} />
        ) : tasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No tasks available right now. Check back soon!</Text>
          </View>
        ) : (
          tasks.map(task => {
            const done = isTaskCompleted(task.id);
            return (
              <Pressable
                key={task.id}
                style={[styles.taskCard, done && styles.taskCardDone]}
                onPress={() => !done && router.push({ pathname: '/task-detail' as any, params: { taskId: task.id } })}
                disabled={done}
              >
                <View style={styles.taskIcon}>{taskIcon(task)}</View>
                <View style={styles.taskInfo}>
                  <Text style={[styles.taskTitle, done && styles.taskTitleDone]}>{task.title}</Text>
                  <Text style={styles.taskReward}>+{task.pointsReward} pts = ₦{(task.pointsReward * 16).toLocaleString()}</Text>
                </View>
                {done ? (
                  <Check size={20} color={Colors.light.success} />
                ) : (
                  <ChevronRight size={20} color={Colors.light.gray} />
                )}
              </Pressable>
            );
          })
        )}

        {/* Promo code input */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Promo code</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Enter promo code"
            value={promoCode}
            onChangeText={setPromoCode}
            autoCapitalize="characters"
          />
          <Button
            title="Apply"
            onPress={handleApplyPromo}
            loading={isApplying}
            disabled={isApplying || !promoCode.trim()}
            style={styles.applyButton}
          />
        </View>

        {/* Active promo badge */}
        {activePromoCode && (
          <View style={styles.activePromoRow}>
            <Tag size={16} color={Colors.light.success} />
            <Text style={styles.activePromoText}>Active: <Text style={styles.activePromoCode}>{activePromoCode}</Text></Text>
            <Pressable onPress={handleRemovePromo} hitSlop={10}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        )}

        {/* Available promo list */}
        {promosLoading ? (
          <ActivityIndicator style={styles.loader} color={Colors.light.primary} />
        ) : promotions.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Available codes</Text>
            {promotions.map(promo => (
              <View key={promo.id} style={styles.promoCard}>
                <View style={styles.promoHeader}>
                  <View style={styles.iconContainer}>
                    <Tag size={18} color={Colors.light.primary} />
                  </View>
                  <View style={styles.promoInfo}>
                    <Text style={styles.promoCode}>{promo.code}</Text>
                    <Text style={styles.promoDescription}>{promo.description}</Text>
                  </View>
                </View>
                <View style={styles.promoMeta}>
                  <Text style={styles.promoDiscount}>{promo.discountPercentage}% off
                    {promo.maxDiscountNGN ? ` (max ₦${promo.maxDiscountNGN.toLocaleString()})` : ''}
                  </Text>
                  <Text style={styles.promoExpiry}>
                    Until {new Date(promo.validUntil).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))}
          </>
        ) : null}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { flex: 1 },
  loader: { marginVertical: 24 },

  balanceCard: {
    margin: 16,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  balanceTexts: {},
  balanceLabel: { fontSize: 12, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8 },
  balancePoints: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  balanceNGN: { alignItems: 'flex-end' },
  balanceNGNText: { fontSize: 16, fontWeight: '700', color: '#60A5FA' },
  balanceNGNSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.light.text,
    marginHorizontal: 16,
    marginBottom: 10,
  },

  emptyCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: Colors.light.white,
    borderWidth: 1,
    borderColor: Colors.light.lightGray,
  },
  emptyText: { fontSize: 14, color: Colors.light.gray, textAlign: 'center' },

  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.light.white,
    borderWidth: 1,
    borderColor: Colors.light.lightGray,
    gap: 12,
  },
  taskCardDone: { opacity: 0.55 },
  taskIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 15, fontWeight: '600', color: Colors.light.text },
  taskTitleDone: { textDecorationLine: 'line-through' },
  taskReward: { fontSize: 13, color: Colors.light.primary, fontWeight: '600', marginTop: 2 },

  inputRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 10,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.light.lightGray,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    backgroundColor: Colors.light.white,
  },
  applyButton: { width: 90 },

  activePromoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.light.success + '15',
    gap: 8,
  },
  activePromoText: { flex: 1, fontSize: 14, color: Colors.light.text },
  activePromoCode: { fontWeight: '700', color: Colors.light.success },
  removeText: { fontSize: 13, color: Colors.light.danger, fontWeight: '600' },

  promoCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.light.white,
    borderWidth: 1,
    borderColor: Colors.light.lightGray,
  },
  promoHeader: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  promoInfo: { flex: 1 },
  promoCode: { fontSize: 15, fontWeight: '700', color: Colors.light.text },
  promoDescription: { fontSize: 13, color: Colors.light.gray, marginTop: 2 },
  promoMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.lightGray,
  },
  promoDiscount: { fontSize: 13, fontWeight: '600', color: Colors.light.success },
  promoExpiry: { fontSize: 13, color: Colors.light.gray },
});
