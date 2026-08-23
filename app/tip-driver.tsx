import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { CheckCircle2 } from 'lucide-react-native';
import Button from '@/components/Button';
import { useTheme } from '@/hooks/useThemeStore';
import { trpcClient } from '@/lib/trpc';
import { TIP_CONFIG, isTipAmountValid } from '@/lib/pricing-config';

type ScreenState = 'loading' | 'prompt' | 'alreadyTipped' | 'closed' | 'success';

export default function TipDriverScreen() {
  const { colors } = useTheme();
  const { rideId, driverId, driverName, source } = useLocalSearchParams<{
    rideId: string;
    driverId: string;
    driverName?: string;
    source?: 'completion' | 'history';
  }>();

  const [state, setState] = useState<ScreenState>('loading');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultAmount, setResultAmount] = useState<number | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!rideId) {
        setState('closed');
        return;
      }
      try {
        const result = await trpcClient.payments.tips.getForRide.query({ rideId });
        if (cancelled) return;

        if (result.alreadyTipped) {
          setResultAmount(result.existingTip?.amount ?? null);
          setState('alreadyTipped');
        } else if (result.eligible) {
          // One idempotency key per attempt, generated once and reused across
          // retries within this screen instance (e.g. insufficient balance ->
          // top up -> retry) — never regenerated per tap, so a double-tap or
          // a retried request can never create two tips/debit twice.
          idempotencyKeyRef.current = Crypto.randomUUID();
          setState('prompt');
        } else {
          setState('closed');
        }
      } catch (error) {
        console.error('Failed to load tip eligibility:', error);
        if (!cancelled) setState('closed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rideId]);

  const finish = () => {
    if (source === 'history') {
      router.back();
      return;
    }
    router.replace({
      pathname: '/rate-driver',
      params: { rideId: rideId ?? '', driverId: driverId ?? '', driverName: driverName ?? '' },
    });
  };

  const amountToSubmit = useMemo(() => {
    if (isCustom) {
      const parsed = parseInt(customAmount, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return selectedPreset;
  }, [isCustom, customAmount, selectedPreset]);

  const amountIsValid = amountToSubmit != null && isTipAmountValid(amountToSubmit);

  const handleSubmit = async () => {
    if (!amountToSubmit || !amountIsValid || !rideId || !driverId || isSubmitting) return;
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = Crypto.randomUUID();

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await trpcClient.payments.tips.create.mutate({
        rideId,
        driverId,
        amount: amountToSubmit,
        idempotencyKey: idempotencyKeyRef.current,
        paymentMethod: 'wallet',
      });

      if (result.status) {
        setResultAmount(amountToSubmit);
        setState('success');
      } else {
        setErrorMessage(result.message);
      }
    } catch (error) {
      console.error('Tip submission failed:', error);
      setErrorMessage('Could not send tip. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectPreset = (amount: number) => {
    setSelectedPreset(amount);
    setIsCustom(false);
    setErrorMessage(null);
  };

  const selectCustom = () => {
    setIsCustom(true);
    setSelectedPreset(null);
    setErrorMessage(null);
  };

  if (state === 'loading') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'alreadyTipped' || state === 'success') {
    const isSuccess = state === 'success';
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerFill}>
          <CheckCircle2 size={64} color={colors.success} />
          <Text style={[styles.title, { color: colors.text, marginTop: 20 }]}>
            {isSuccess ? 'Tip sent! 🎉' : 'Tip sent ✓'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {resultAmount != null
              ? `You sent ₦${resultAmount.toLocaleString()} to your driver.`
              : 'You already tipped your driver for this ride.'}
          </Text>
          {isSuccess && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Thanks for showing your appreciation.
            </Text>
          )}
          <View style={styles.doneButtonWrap}>
            <Button title="Done" onPress={finish} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'closed') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerFill}>
          <Text style={[styles.title, { color: colors.text }]}>Tipping isn&apos;t available</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            This ride isn&apos;t eligible for a tip right now.
          </Text>
          <View style={styles.doneButtonWrap}>
            <Button title="Continue" onPress={finish} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Enjoyed the ride? 😊</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Show your driver some appreciation with a tip.
            </Text>
          </View>

          <View style={styles.presetsRow}>
            {TIP_CONFIG.presetAmounts.map((amount) => {
              const selected = !isCustom && selectedPreset === amount;
              return (
                <Pressable
                  key={amount}
                  style={[
                    styles.presetChip,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    selected && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => selectPreset(amount)}
                >
                  <Text style={[styles.presetChipText, { color: selected ? colors.white : colors.text }]}>
                    ₦{amount.toLocaleString()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={[
              styles.customChip,
              { backgroundColor: colors.card, borderColor: colors.border },
              isCustom && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={selectCustom}
          >
            <Text style={[styles.customChipText, { color: isCustom ? colors.white : colors.text }]}>
              Custom amount
            </Text>
          </Pressable>

          {isCustom && (
            <View style={styles.customInputWrap}>
              <Text style={[styles.customInputLabel, { color: colors.text }]}>
                How much would you like to tip?
              </Text>
              <View style={[styles.inputRow, { borderColor: colors.border }]}>
                <Text style={[styles.currencySymbol, { color: colors.text }]}>₦</Text>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  value={customAmount}
                  onChangeText={setCustomAmount}
                />
              </View>
              <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
                Between ₦{TIP_CONFIG.minAmount.toLocaleString()} and ₦{TIP_CONFIG.maxAmount.toLocaleString()}
              </Text>
            </View>
          )}

          {errorMessage && (
            <View style={[styles.errorBox, { backgroundColor: colors.danger + '15' }]}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <Button
              title={amountToSubmit ? `Tip Driver — ₦${amountToSubmit.toLocaleString()}` : 'Tip Driver'}
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting || !amountIsValid}
            />
            <Pressable onPress={finish} style={styles.laterButton} disabled={isSubmitting}>
              <Text style={[styles.laterText, { color: colors.textSecondary }]}>Maybe later</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  centerFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  content: {
    padding: 24,
    gap: 20,
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  presetChip: {
    minWidth: 76,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  presetChipText: {
    fontSize: 16,
    fontWeight: '700',
  },
  customChip: {
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  customChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  customInputWrap: {
    gap: 8,
  },
  customInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '600',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 20,
    paddingVertical: 14,
  },
  inputHint: {
    fontSize: 12,
    textAlign: 'center',
  },
  errorBox: {
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  actions: {
    gap: 4,
    marginTop: 8,
  },
  laterButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  laterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  doneButtonWrap: {
    width: '100%',
    marginTop: 28,
  },
});
