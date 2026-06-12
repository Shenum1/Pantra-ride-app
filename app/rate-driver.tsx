import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Star } from 'lucide-react-native';
import Button from '@/components/Button';
import Colors from '@/constants/colors';
import { useRatings } from '@/hooks/useRatingsStore';

const QUICK_COMMENTS = [
  'Great driver!',
  'Very punctual',
  'Clean vehicle',
  'Safe driving',
  'Friendly',
  'Professional',
];

export default function RateDriverScreen() {
  const { rideId, driverId, driverName } = useLocalSearchParams<{ rideId: string; driverId: string; driverName: string }>();
  const { addReview } = useRatings();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating required', 'Please select a star rating before submitting.');
      return;
    }

    if (!driverId || !rideId) {
      Alert.alert('Error', 'Ride information is missing.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addReview(rideId, driverId, rating, comment || undefined);
      router.replace('/(tabs)/home');
    } catch (error) {
      Alert.alert('Error', 'Could not submit your rating. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)/home');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Rate your driver</Text>
          <Text style={styles.subtitle}>
            How was your experience with {driverName || 'your driver'}?
          </Text>
        </View>

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => setRating(star)} style={styles.starButton}>
              <Star
                size={44}
                color={star <= rating ? '#F59E0B' : '#D1D5DB'}
                fill={star <= rating ? '#F59E0B' : 'transparent'}
              />
            </Pressable>
          ))}
        </View>

        {rating > 0 && (
          <Text style={styles.ratingLabel}>
            {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]}
          </Text>
        )}

        <View style={styles.quickCommentsWrap}>
          {QUICK_COMMENTS.map((tag) => {
            const selected = comment === tag;
            return (
              <Pressable
                key={tag}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => setComment(selected ? '' : tag)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>{tag}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          style={styles.textInput}
          placeholder="Add a comment (optional)"
          placeholderTextColor="#94A3B8"
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={3}
          maxLength={300}
        />

        <Button
          title="Submit rating"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting || rating === 0}
        />

        <Pressable onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F6FB',
  },
  content: {
    padding: 24,
    gap: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  starButton: {
    padding: 4,
  },
  ratingLabel: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#F59E0B',
    marginTop: -8,
  },
  quickCommentsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    fontSize: 15,
    color: '#0F172A',
    minHeight: 90,
    textAlignVertical: 'top',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
