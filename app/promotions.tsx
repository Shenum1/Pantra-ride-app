import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Tag, Check, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePromotions } from '@/hooks/usePromotionsStore';
import Button from '@/components/Button';

export default function PromotionsScreen() {
  const { promotions, addPromotion, applyPromoCode, markPromoAsUsed } = usePromotions();
  const [promoCode, setPromoCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddPromo = () => {
    if (!promoCode.trim()) {
      Alert.alert('Error', 'Please enter a promo code');
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call to validate promo code
    setTimeout(() => {
      // Check if promo already exists
      const existingPromo = promotions.find(p => p.code.toLowerCase() === promoCode.toLowerCase());
      
      if (existingPromo) {
        Alert.alert('Error', 'This promo code has already been added');
      } else {
        // In a real app, we would validate this with a backend
        const newPromo = {
          code: promoCode,
          description: 'Get 20% off your next ride',
          discountPercentage: 20,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          isUsed: false,
        };
        
        addPromotion(newPromo);
        setPromoCode('');
        Alert.alert('Success', 'Promo code added successfully');
      }
      
      setIsSubmitting(false);
    }, 1000);
  };

  const handleActivate = (code: string) => {
    applyPromoCode(code);
    Alert.alert('Promo Activated', 'Promo code has been activated for your next ride');
  };

  const handleRemove = (id: string) => {
    Alert.alert(
      'Remove Promotion',
      'Are you sure you want to remove this promotion?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => {
            // Mark as used instead of removing since we don't have a remove function
            markPromoAsUsed(promotions.find(p => p.id === id)?.code || '');
            Alert.alert('Removed', 'Promotion has been removed');
          }
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ 
        title: 'Promotions',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: Colors.light.background },
      }} />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter promo code"
          value={promoCode}
          onChangeText={setPromoCode}
          autoCapitalize="characters"
          testID="promo-code-input"
        />
        <Button
          title="Apply"
          onPress={handleAddPromo}
          loading={isSubmitting}
          disabled={isSubmitting || !promoCode.trim()}
          style={styles.applyButton}
          testID="apply-promo-button"
        />
      </View>

      <ScrollView style={styles.content}>
        {promotions.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Your promotions</Text>
            
            {promotions.map(promo => (
              <View key={promo.id} style={styles.promoCard}>
                <View style={styles.promoHeader}>
                  <View style={styles.iconContainer}>
                    <Tag size={20} color={Colors.light.primary} />
                  </View>
                  <View style={styles.promoInfo}>
                    <Text style={styles.promoCode}>{promo.code}</Text>
                    <Text style={styles.promoDescription}>{promo.description}</Text>
                  </View>
                </View>
                
                <View style={styles.promoDetails}>
                  <Text style={styles.promoDiscount}>{promo.discountPercentage}% off</Text>
                  <Text style={styles.promoExpiry}>
                    Expires: {new Date(promo.validUntil).toLocaleDateString()}
                  </Text>
                </View>
                
                <View style={styles.promoActions}>
                  {promo.isUsed ? (
                    <View style={styles.activeTag}>
                      <Check size={16} color={Colors.light.success} />
                      <Text style={styles.activeText}>Used</Text>
                    </View>
                  ) : (
                    <Pressable 
                      style={styles.activateButton}
                      onPress={() => handleActivate(promo.code)}
                      testID={`activate-promo-${promo.id}`}
                    >
                      <Text style={styles.activateText}>Activate</Text>
                    </Pressable>
                  )}
                  
                  <Pressable 
                    hitSlop={10}
                    onPress={() => handleRemove(promo.id)}
                    style={styles.removeButton}
                    testID={`remove-promo-${promo.id}`}
                  >
                    <X size={18} color={Colors.light.danger} />
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Tag size={48} color={Colors.light.gray} />
            <Text style={styles.emptyTitle}>No promotions yet</Text>
            <Text style={styles.emptyText}>
              Enter a promo code above to get discounts on your rides
            </Text>
          </View>
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
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.lightGray,
    backgroundColor: Colors.light.white,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.light.lightGray,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 12,
    fontSize: 16,
  },
  applyButton: {
    width: 100,
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
  promoCard: {
    backgroundColor: Colors.light.white,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.lightGray,
  },
  promoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  promoInfo: {
    flex: 1,
  },
  promoCode: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  promoDescription: {
    fontSize: 14,
    color: Colors.light.gray,
    marginTop: 2,
  },
  promoDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.lightGray,
  },
  promoDiscount: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.success,
  },
  promoExpiry: {
    fontSize: 14,
    color: Colors.light.gray,
  },
  promoActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.lightGray,
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.success + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  activeText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.success,
    marginLeft: 4,
  },
  activateButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  activateText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.white,
  },
  removeButton: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.gray,
    textAlign: 'center',
  },
});