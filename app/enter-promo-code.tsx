import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Tag, Check } from 'lucide-react-native';
import Button from '@/components/Button';
import { usePromotions } from '@/hooks/usePromotionsStore';
import { useTheme } from '@/hooks/useThemeStore';

export default function EnterPromoCodeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { promotions, applyPromoCode, getActivePromotion } = usePromotions();
  const [promoCode, setPromoCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const activePromo = getActivePromotion();

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      Alert.alert('Error', 'Please enter a promo code');
      return;
    }

    setIsApplying(true);
    try {
      const result = await applyPromoCode(promoCode.trim().toUpperCase());
      if (result.success) {
        Alert.alert(
          'Success!',
          result.message,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', result.message);
      }
    } catch {
      Alert.alert('Error', 'Failed to apply promo code');
    } finally {
      setIsApplying(false);
    }
  };

  const availablePromos = promotions.filter(p => new Date(p.validUntil) > new Date());

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Enter Promo Code',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      
      <ScrollView style={styles.content}>
        {activePromo && (
          <View style={[styles.activePromoCard, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
            <View style={styles.activePromoHeader}>
              <Check size={20} color={colors.success} />
              <Text style={[styles.activePromoTitle, { color: colors.success }]}>Active Promo</Text>
            </View>
            <Text style={[styles.activePromoCode, { color: colors.text }]}>{activePromo.code}</Text>
            <Text style={[styles.activePromoDescription, { color: colors.gray }]}>
              {activePromo.description}
            </Text>
          </View>
        )}

        <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Enter Promo Code</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            value={promoCode}
            onChangeText={setPromoCode}
            placeholder="Enter code here"
            placeholderTextColor={colors.gray}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Button
            title="Apply Code"
            onPress={handleApplyPromo}
            loading={isApplying}
            disabled={isApplying || !promoCode.trim()}
            style={styles.applyButton}
          />
        </View>

        {availablePromos.length > 0 && (
          <View style={styles.availablePromosSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Available Promotions</Text>
            {availablePromos.map((promo) => (
              <View key={promo.id} style={[styles.promoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.promoHeader}>
                  <Tag size={16} color={colors.primary} />
                  <Text style={[styles.promoCode, { color: colors.primary }]}>{promo.code}</Text>
                </View>
                <Text style={[styles.promoDescription, { color: colors.text }]}>
                  {promo.description}
                </Text>
                <Text style={[styles.promoExpiry, { color: colors.gray }]}>
                  Valid until {new Date(promo.validUntil).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  activePromoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  activePromoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activePromoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  activePromoCode: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  activePromoDescription: {
    fontSize: 14,
  },
  inputCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  applyButton: {
    marginTop: 8,
  },
  availablePromosSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  promoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  promoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  promoCode: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  promoDescription: {
    fontSize: 14,
    marginBottom: 4,
  },
  promoExpiry: {
    fontSize: 12,
  },
});