import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { CreditCard, Plus, Trash2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePayment } from '@/hooks/usePaymentStore';
import Button from '@/components/Button';

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { paymentMethods, setDefaultPaymentMethod, removePaymentMethod } = usePayment();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSetDefault = () => {
    if (selectedId) {
      const method = paymentMethods.find(m => m.id === selectedId);
      if (method) {
        setDefaultPaymentMethod(method.id);
        Alert.alert('Default Updated', `${method.name} is now your default payment method`);
      }
    }
  };

  const handleRemove = (id: string) => {
    Alert.alert(
      'Remove Payment Method',
      'Are you sure you want to remove this payment method?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => {
            removePaymentMethod(id);
            if (selectedId === id) {
              setSelectedId(null);
            }
          }
        },
      ]
    );
  };

  const handleAddNew = () => {
    router.push('/add-payment-method');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ 
        title: 'Payment Methods',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: Colors.light.background },
      }} />

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Your payment methods</Text>
        
        {paymentMethods.map(method => (
          <Pressable 
            key={method.id}
            style={[styles.paymentCard, selectedId === method.id && styles.selectedCard]}
            onPress={() => setSelectedId(method.id)}
            testID={`payment-method-${method.id}`}
          >
            <View style={styles.paymentCardLeft}>
              <View style={styles.iconContainer}>
                <CreditCard size={20} color={Colors.light.text} />
              </View>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentName}>{method.name}</Text>
                <Text style={styles.paymentDetails}>
                  {method.isDefault && '(Default) '}
                  {method.lastFour ? `\u2022\u2022\u2022\u2022 ${method.lastFour}` : ''}
                  {method.expiryDate ? ` \u2022 Expires ${method.expiryDate}` : ''}
                </Text>
              </View>
            </View>
            <Pressable 
              hitSlop={10}
              onPress={() => handleRemove(method.id)}
              style={styles.deleteButton}
              testID={`delete-payment-${method.id}`}
            >
              <Trash2 size={18} color={Colors.light.danger} />
            </Pressable>
          </Pressable>
        ))}

        <Pressable 
          style={styles.addNewButton}
          onPress={handleAddNew}
          testID="add-payment-method"
        >
          <Plus size={20} color={Colors.light.primary} />
          <Text style={styles.addNewText}>Add payment method</Text>
        </Pressable>
      </ScrollView>

      {selectedId && (
        <View style={styles.buttonContainer}>
          <Button 
            title="Set as Default" 
            onPress={handleSetDefault} 
            testID="set-default-button"
          />
        </View>
      )}
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
    marginBottom: 12,
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
  deleteButton: {
    padding: 8,
  },
  addNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.white,
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    borderStyle: 'dashed',
  },
  addNewText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.primary,
    marginLeft: 8,
  },
  buttonContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.lightGray,
  },
});