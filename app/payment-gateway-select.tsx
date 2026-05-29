import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { CreditCard, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Button from '@/components/Button';

type PaymentGateway = 'paystack' | 'flutterwave' | 'cash';

interface GatewayOption {
  id: PaymentGateway;
  name: string;
  description: string;
  icon: string;
  available: boolean;
}

const paymentGateways: GatewayOption[] = [
  {
    id: 'paystack',
    name: 'Paystack',
    description: 'Pay with card, bank transfer, or USSD',
    icon: '💳',
    available: true,
  },
  {
    id: 'flutterwave',
    name: 'Flutterwave',
    description: 'Pay with card, bank, or mobile money',
    icon: '🦋',
    available: true,
  },
  {
    id: 'cash',
    name: 'Cash',
    description: 'Pay with cash after the ride',
    icon: '💵',
    available: true,
  },
];

export default function PaymentGatewaySelectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const amount = params.amount ? parseFloat(params.amount as string) : 0;
  const purpose = (params.purpose as string) || 'ride';
  
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>('paystack');

  const handleContinue = () => {
    if (selectedGateway === 'cash') {
      Alert.alert('Cash Payment', 'You can pay with cash after the ride is completed.');
      router.back();
      return;
    }

    router.push({
      pathname: '/payment-initialize' as any,
      params: {
        gateway: selectedGateway,
        amount: amount.toString(),
        purpose,
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Select Payment Method',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: Colors.light.background },
        }}
      />

      <ScrollView style={styles.content}>
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Amount to Pay</Text>
          <Text style={styles.amountValue}>₦{amount.toFixed(0)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Choose Payment Gateway</Text>

        {paymentGateways.map((gateway) => (
          <Pressable
            key={gateway.id}
            style={[
              styles.gatewayCard,
              selectedGateway === gateway.id && styles.selectedGatewayCard,
              !gateway.available && styles.disabledGatewayCard,
            ]}
            onPress={() => gateway.available && setSelectedGateway(gateway.id)}
            disabled={!gateway.available}
          >
            <View style={styles.gatewayIcon}>
              <Text style={styles.gatewayIconText}>{gateway.icon}</Text>
            </View>
            <View style={styles.gatewayInfo}>
              <Text style={styles.gatewayName}>{gateway.name}</Text>
              <Text style={styles.gatewayDescription}>{gateway.description}</Text>
              {!gateway.available && (
                <Text style={styles.comingSoonText}>Coming Soon</Text>
              )}
            </View>
            {selectedGateway === gateway.id && gateway.available && (
              <View style={styles.checkIcon}>
                <Check size={20} color={Colors.light.white} />
              </View>
            )}
          </Pressable>
        ))}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>💡 Payment Gateway Setup</Text>
          <Text style={styles.infoText}>
            To enable real payments, you need to add your API keys:
          </Text>
          <Text style={styles.infoText}>
            • EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY{'\n'}
            • EXPO_PUBLIC_PAYSTACK_SECRET_KEY{'\n'}
            • EXPO_PUBLIC_FLUTTERWAVE_PUBLIC_KEY{'\n'}
            • EXPO_PUBLIC_FLUTTERWAVE_SECRET_KEY
          </Text>
          <Text style={styles.infoText}>
            Get your keys from:{'\n'}
            • Paystack: https://paystack.com{'\n'}
            • Flutterwave: https://flutterwave.com
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Continue"
          onPress={handleContinue}
          disabled={!selectedGateway}
        />
      </View>
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
  amountCard: {
    margin: 16,
    padding: 24,
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: Colors.light.white,
    opacity: 0.9,
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.light.white,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    marginHorizontal: 16,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gatewayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: Colors.light.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.lightGray,
  },
  selectedGatewayCard: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primaryLight,
  },
  disabledGatewayCard: {
    opacity: 0.5,
  },
  gatewayIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  gatewayIconText: {
    fontSize: 28,
  },
  gatewayInfo: {
    flex: 1,
  },
  gatewayName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  gatewayDescription: {
    fontSize: 13,
    color: Colors.light.gray,
  },
  comingSoonText: {
    fontSize: 12,
    color: Colors.light.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  checkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBox: {
    margin: 16,
    padding: 16,
    backgroundColor: Colors.light.lightGray,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: Colors.light.text,
    lineHeight: 18,
    marginBottom: 8,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.lightGray,
    backgroundColor: Colors.light.white,
  },
});
