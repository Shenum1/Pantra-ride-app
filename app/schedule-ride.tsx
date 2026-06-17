import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Calendar, Clock, MapPin } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import Toast from 'react-native-toast-message';
import Button from '@/components/Button';
import Colors from '@/constants/colors';
import { useRide } from '@/hooks/useRideStore';

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

export default function ScheduleRideScreen() {
  const { scheduleRide } = useRide();

  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const [selectedDate, setSelectedDate] = useState<Date>(tomorrow);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const onDateChange = (_: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      const merged = new Date(date);
      merged.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      setSelectedDate(merged);
    }
  };

  const onTimeChange = (_: DateTimePickerEvent, date?: Date) => {
    setShowTimePicker(false);
    if (date) {
      const merged = new Date(selectedDate);
      merged.setHours(date.getHours(), date.getMinutes(), 0, 0);
      setSelectedDate(merged);
    }
  };

  const handleScheduleRide = async () => {
    if (!pickup || !destination) {
      Alert.alert('Error', 'Please enter both pickup and destination');
      return;
    }

    const now = new Date();
    const minTime = new Date(now.getTime() + 15 * 60 * 1000);
    if (selectedDate <= minTime) {
      Alert.alert('Invalid Time', 'Please schedule at least 15 minutes from now');
      return;
    }

    scheduleRide(selectedDate);

    // Schedule a local reminder 30 min before
    const reminderTime = new Date(selectedDate.getTime() - 30 * 60 * 1000);
    if (reminderTime > now) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Upcoming Ride',
            body: `Your ride from ${pickup} starts in 30 minutes`,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderTime },
        });
      } catch {
        // Notification permission may not be granted — non-fatal
      }
    }

    Toast.show({
      type: 'success',
      text1: 'Ride Scheduled',
      text2: `${formatDate(selectedDate)} at ${formatTime(selectedDate)} — book your route now`,
      position: 'top',
      visibilityTime: 4000,
    });

    router.replace('/(tabs)/home');
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Schedule a Ride' }} />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Schedule your ride</Text>
            <Text style={styles.subtitle}>
              Plan ahead and never worry about getting a ride
            </Text>
          </View>

          <View style={styles.form}>
            {/* Locations */}
            <View style={styles.inputGroup}>
              <View style={styles.inputContainer}>
                <View style={styles.inputIcon}>
                  <MapPin size={20} color={Colors.light.primary} />
                </View>
                <TextInput
                  style={styles.input}
                  value={pickup}
                  onChangeText={setPickup}
                  placeholder="Pickup location"
                  testID="pickup-input"
                />
              </View>
              <View style={[styles.inputContainer, { borderBottomWidth: 0 }]}>
                <View style={styles.inputIcon}>
                  <MapPin size={20} color={Colors.light.secondary} />
                </View>
                <TextInput
                  style={styles.input}
                  value={destination}
                  onChangeText={setDestination}
                  placeholder="Where to?"
                  testID="destination-input"
                />
              </View>
            </View>

            {/* Date & Time pickers */}
            <View style={styles.dateTimeContainer}>
              <TouchableOpacity
                style={styles.dateTimeInput}
                onPress={() => setShowDatePicker(true)}
                testID="date-input"
              >
                <View style={styles.inputIcon}>
                  <Calendar size={20} color={Colors.light.primary} />
                </View>
                <View>
                  <Text style={styles.pickerLabel}>Date</Text>
                  <Text style={styles.pickerValue}>{formatDate(selectedDate)}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateTimeInput}
                onPress={() => setShowTimePicker(true)}
                testID="time-input"
              >
                <View style={styles.inputIcon}>
                  <Clock size={20} color={Colors.light.primary} />
                </View>
                <View>
                  <Text style={styles.pickerLabel}>Time</Text>
                  <Text style={styles.pickerValue}>{formatTime(selectedDate)}</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* iOS: inline pickers shown directly; Android: modal dialogs */}
            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={onDateChange}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onTimeChange}
              />
            )}

            <View style={styles.infoSection}>
              <Text style={styles.infoTitle}>Why schedule rides?</Text>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>•</Text>
                <Text style={styles.infoText}>Guaranteed ride at your scheduled time</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>•</Text>
                <Text style={styles.infoText}>Reminder notification 30 minutes before</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>•</Text>
                <Text style={styles.infoText}>Perfect for important appointments</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Schedule Ride"
            onPress={handleScheduleRide}
            style={styles.scheduleButton}
          />
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  header: {
    paddingVertical: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.gray,
    lineHeight: 22,
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    backgroundColor: Colors.light.white,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.lightGray,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  dateTimeInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    gap: 10,
  },
  pickerLabel: {
    fontSize: 11,
    color: Colors.light.gray,
    marginBottom: 2,
  },
  pickerValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
  },
  infoSection: {
    backgroundColor: Colors.light.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  infoBullet: {
    fontSize: 16,
    color: Colors.light.primary,
    marginRight: 8,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.gray,
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    backgroundColor: Colors.light.white,
    borderTopWidth: 1,
    borderTopColor: Colors.light.lightGray,
  },
  scheduleButton: {
    width: '100%',
  },
});
