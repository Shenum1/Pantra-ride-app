import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Wallet as WalletIcon, Banknote, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePayment } from '@/hooks/usePaymentStore';
import { useWallet } from '@/hooks/useWalletStore';
import { SkeletonRow, ShimmerGroup } from '@/components/skeletons';

// Pantra is cardless: exactly two ways to pay for a ride, Pantra Wallet or
// Cash. No card entry, no saved card list — see
// database/schemas/supabase-schema-payment-methods-cardless-deprecation.sql.
// Selecting one here sets it as the rider's default payment method
// (usePayment().setDefaultPaymentMethod), which useRideStore's requestRide()
// falls back to whenever a ride isn't given an explicit per-trip override.
export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { paymentMethods, isLoading, addPaymentMethod, setDefaultPaymentMethod } = usePayment();
  const { balance } = useWallet();
  const seeding = useRef(false);

  const cashMethod = paymentMethods.find((m) => m.type === 'cash');
  const walletMethod = paymentMethods.find((m) => m.type === 'wallet');

  // First visit for this rider: seed the two fixed options once, Cash
  // default (matches the pre-existing paymentMethod="cash" server default
  // in rides/create/route.ts, so a rider who never opens this screen at all
  // still behaves exactly as before).
  useEffect(() => {
    if (isLoading || seeding.current) return;
    if (!cashMethod && !walletMethod && paymentMethods.length === 0) {
      seeding.current = true;
      (async () => {
        try {
          await addPaymentMethod({ type: 'cash', name: 'Cash', isDefault: true, icon: 'banknote' });
          await addPaymentMethod({ type: 'wallet', name: 'Pantra Wallet', isDefault: false, icon: 'wallet' });
        } catch (error) {
          console.error('Error seeding default payment methods:', error);
        } finally {
          seeding.current = false;
        }
      })();
    }
  }, [isLoading, cashMethod, walletMethod, paymentMethods.length, addPaymentMethod]);

  const handleSelect = async (id: string, name: string) => {
    try {
      await setDefaultPaymentMethod(id);
      Alert.alert('Default Updated', `${name} is now your default payment method`);
    } catch (error) {
      console.error('Error setting default payment method:', error);
      Alert.alert('Error', 'Could not update your default payment method. Please try again.');
    }
  };

  const options = [
    walletMethod && {
      method: walletMethod,
      icon: WalletIcon,
      subtitle: `Balance: ₦${balance.toLocaleString()}`,
    },
    cashMethod && {
      method: cashMethod,
      icon: Banknote,
      subtitle: 'Pay the driver directly after your ride',
    },
  ].filter(Boolean) as { method: NonNullable<typeof cashMethod>; icon: typeof WalletIcon; subtitle: string }[];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{
        title: 'Payment Methods',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: Colors.light.background },
      }} />

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>How you pay</Text>
        <Text style={styles.sectionSubtitle}>Pantra is cardless — choose your wallet or pay cash.</Text>

        {isLoading || options.length === 0 ? (
          <View style={styles.skeletonContainer}>
            <ShimmerGroup>
              <SkeletonRow leadingSize={40} style={styles.skeletonRow} />
              <SkeletonRow leadingSize={40} style={styles.skeletonRow} />
            </ShimmerGroup>
          </View>
        ) : options.map(({ method, icon: Icon, subtitle }) => (
          <Pressable
            key={method.id}
            style={[styles.paymentCard, method.isDefault && styles.selectedCard]}
            onPress={() => handleSelect(method.id, method.name)}
            testID={`payment-method-${method.type}`}
          >
            <View style={styles.paymentCardLeft}>
              <View style={styles.iconContainer}>
                <Icon size={20} color={Colors.light.text} />
              </View>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentName}>{method.name}</Text>
                <Text style={styles.paymentDetails}>{subtitle}</Text>
              </View>
            </View>
            {method.isDefault && (
              <View style={styles.checkBadge}>
                <Check size={16} color={Colors.light.white} />
              </View>
            )}
          </Pressable>
        ))}

        {walletMethod && walletMethod.isDefault && balance <= 0 && (
          <Pressable style={styles.topUpBanner} onPress={() => router.push('/wallet-add-money' as any)}>
            <Text style={styles.topUpBannerText}>Your wallet is empty — add money to pay for rides with it</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.light.gray,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.white,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.lightGray,
  },
  selectedCard: {
    borderColor: Colors.light.primary,
    borderWidth: 2,
  },
  paymentCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  paymentDetails: {
    fontSize: 14,
    color: Colors.light.gray,
    marginTop: 2,
  },
  checkBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonContainer: {
    marginHorizontal: 16,
    gap: 12,
  },
  skeletonRow: {
    marginBottom: 0,
  },
  topUpBanner: {
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
  },
  topUpBannerText: {
    fontSize: 13,
    color: Colors.light.text,
    lineHeight: 18,
  },
});
