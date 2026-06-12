import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { CreditCard, Lightbulb, FileText } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import { usePayment } from '@/hooks/usePaymentStore';
import { PaymentMethod } from '@/types';

export default function AddPaymentMethodScreen() {
  const router = useRouter();
  const { addPaymentMethod } = usePayment();
  
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [loading, setLoading] = useState(false);

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted;
  };

  const formatExpiryDate = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };

  const handleCardNumberChange = (text: string) => {
    const cleaned = text.replace(/\s/g, '');
    if (cleaned.length <= 16) {
      setCardNumber(formatCardNumber(cleaned));
    }
  };

  const handleExpiryChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 4) {
      setExpiryDate(formatExpiryDate(text));
    }
  };

  const handleCvvChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 4) {
      setCvv(cleaned);
    }
  };

  const validateCard = (): boolean => {
    const cleanedCardNumber = cardNumber.replace(/\s/g, '');
    
    if (cleanedCardNumber.length < 15 || cleanedCardNumber.length > 16) {
      Alert.alert('Invalid Card', 'Please enter a valid card number');
      return false;
    }

    if (!cardholderName.trim()) {
      Alert.alert('Invalid Name', 'Please enter the cardholder name');
      return false;
    }

    if (expiryDate.length !== 5) {
      Alert.alert('Invalid Expiry', 'Please enter a valid expiry date (MM/YY)');
      return false;
    }

    const [month, year] = expiryDate.split('/').map(Number);
    if (month < 1 || month > 12) {
      Alert.alert('Invalid Expiry', 'Please enter a valid month (01-12)');
      return false;
    }

    const currentYear = new Date().getFullYear() % 100;
    const currentMonth = new Date().getMonth() + 1;
    
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      Alert.alert('Invalid Expiry', 'Card has expired');
      return false;
    }

    if (cvv.length < 3 || cvv.length > 4) {
      Alert.alert('Invalid CVV', 'Please enter a valid CVV');
      return false;
    }

    return true;
  };

  const handleAddCard = async () => {
    if (!validateCard()) {
      return;
    }

    try {
      setLoading(true);

      const cleanedCardNumber = cardNumber.replace(/\s/g, '');
      const lastFour = cleanedCardNumber.slice(-4);

      const newMethod: Omit<PaymentMethod, 'id'> = {
        type: 'card',
        name: cardholderName,
        lastFour,
        expiryDate,
        isDefault: false,
        icon: 'credit-card',
      };

      await addPaymentMethod(newMethod);

      Alert.alert(
        'Success',
        'Card added successfully',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error adding card:', error);
      Alert.alert('Error', 'Failed to add card. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Add Payment Method',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: Colors.light.background },
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.cardPreview}>
            <View style={styles.cardPreviewHeader}>
              <CreditCard size={32} color={Colors.light.white} />
            </View>
            <View style={styles.cardPreviewContent}>
              <Text style={styles.cardPreviewNumber}>
                {cardNumber || '•••• •••• •••• ••••'}
              </Text>
              <View style={styles.cardPreviewFooter}>
                <View>
                  <Text style={styles.cardPreviewLabel}>CARDHOLDER NAME</Text>
                  <Text style={styles.cardPreviewText}>
                    {cardholderName || 'NAME ON CARD'}
                  </Text>
                </View>
                <View>
                  <Text style={styles.cardPreviewLabel}>EXPIRES</Text>
                  <Text style={styles.cardPreviewText}>
                    {expiryDate || 'MM/YY'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Card Number</Text>
              <TextInput
                style={styles.input}
                value={cardNumber}
                onChangeText={handleCardNumberChange}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor={Colors.light.gray}
                keyboardType="number-pad"
                maxLength={19}
                testID="card-number-input"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cardholder Name</Text>
              <TextInput
                style={styles.input}
                value={cardholderName}
                onChangeText={setCardholderName}
                placeholder="John Doe"
                placeholderTextColor={Colors.light.gray}
                autoCapitalize="words"
                testID="cardholder-name-input"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.label}>Expiry Date</Text>
                <TextInput
                  style={styles.input}
                  value={expiryDate}
                  onChangeText={handleExpiryChange}
                  placeholder="MM/YY"
                  placeholderTextColor={Colors.light.gray}
                  keyboardType="number-pad"
                  maxLength={5}
                  testID="expiry-date-input"
                />
              </View>

              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.label}>CVV</Text>
                <TextInput
                  style={styles.input}
                  value={cvv}
                  onChangeText={handleCvvChange}
                  placeholder="123"
                  placeholderTextColor={Colors.light.gray}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                  testID="cvv-input"
                />
              </View>
            </View>

            <View style={[styles.infoBox, styles.infoBoxRow]}>
              <Lightbulb size={16} color={Colors.light.text} />
              <Text style={styles.infoText}>
                Your card information is encrypted and stored securely
              </Text>
            </View>

            <View style={[styles.infoBox, styles.infoBoxRow]}>
              <FileText size={16} color={Colors.light.text} />
              <Text style={styles.infoText}>
                Note: This is a demo. In production, use Paystack/Flutterwave for secure card processing
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={loading ? 'Adding Card...' : 'Add Card'}
            onPress={handleAddCard}
            disabled={loading}
            testID="add-card-button"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  cardPreview: {
    height: 200,
    borderRadius: 16,
    backgroundColor: Colors.light.primary,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 40,
  },
  cardPreviewContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardPreviewNumber: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.light.white,
    letterSpacing: 2,
  },
  cardPreviewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardPreviewLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  cardPreviewText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.white,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  input: {
    height: 50,
    backgroundColor: Colors.light.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.lightGray,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.light.text,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  infoBox: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  infoBoxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
    lineHeight: 18,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.lightGray,
    backgroundColor: Colors.light.white,
  },
});
