import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const DRIVER_NOTIFICATIONS_PREF_KEY = 'driver_notifications_enabled';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId
  );
}

async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function getExpoPushToken(): Promise<string | null> {
  try {
    const projectId = getProjectId();
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenData.data;
  } catch (err) {
    console.warn('Could not get Expo push token:', err);
    return null;
  }
}

export class NotificationService {
  // Wraps the module-private permission flow so callers (e.g. a settings
  // toggle) can request permission explicitly, outside of push-token registration.
  static async requestPermissions(): Promise<boolean> {
    return requestPermissions();
  }

  // Local, per-device preference — there is no server-side notification-preference
  // table for drivers today. Gates whether this device raises local alerts for
  // driver-facing events (see notifyNewRideRequest's call site in useDriverStore);
  // it does not affect registerDriverPushToken, which the OS-level permission
  // check above already gates.
  static async getDriverNotificationsEnabled(): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem(DRIVER_NOTIFICATIONS_PREF_KEY);
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  }

  static async setDriverNotificationsEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(DRIVER_NOTIFICATIONS_PREF_KEY, String(enabled));
  }

  static async registerRiderPushToken(userId: string): Promise<void> {
    if (Platform.OS === 'web') return;
    const granted = await requestPermissions();
    if (!granted) return;

    const token = await getExpoPushToken();
    if (!token) return;

    await supabase.from('users').update({ pushToken: token }).eq('id', userId);
  }

  static async registerDriverPushToken(driverId: string): Promise<void> {
    if (Platform.OS === 'web') return;
    const granted = await requestPermissions();
    if (!granted) return;

    const token = await getExpoPushToken();
    if (!token) return;

    await supabase.from('drivers').update({ pushToken: token }).eq('id', driverId);
  }

  static async sendLocalNotification(
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    if (Platform.OS === 'web') return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: true },
      trigger: null,
    });
  }

  static async notifyDriverAssigned(
    _userId: string,
    driverName: string,
    eta: number
  ): Promise<void> {
    await this.sendLocalNotification(
      'Driver Assigned!',
      `${driverName} will arrive in ${eta} minutes`,
      { type: 'driver_assigned' }
    );
  }

  static async notifyDriverArrived(_userId: string, driverName: string): Promise<void> {
    await this.sendLocalNotification(
      'Driver Arrived',
      `${driverName} has arrived at your location`,
      { type: 'driver_arrived' }
    );
  }

  static async notifyRideStarted(_userId: string): Promise<void> {
    await this.sendLocalNotification(
      'Ride Started',
      'Your ride has started. Have a safe journey!',
      { type: 'ride_started' }
    );
  }

  static async notifyRideCompleted(_userId: string, fare: number): Promise<void> {
    await this.sendLocalNotification(
      'Ride Completed',
      `Your ride is complete. Total fare: ₦${fare.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`,
      { type: 'ride_completed' }
    );
  }

  static async notifyNewRideRequest(
    _driverId: string,
    pickupAddress: string,
    fare: number
  ): Promise<void> {
    await this.sendLocalNotification(
      'New Ride Request',
      `Pickup: ${pickupAddress} — ₦${Math.round(fare).toLocaleString('en-NG')}`,
      { type: 'new_ride_request' }
    );
  }

  static setupNotificationListeners(
    onNotificationReceived: (notification: Notifications.Notification) => void,
    onNotificationResponse: (response: Notifications.NotificationResponse) => void
  ): () => void {
    const received = Notifications.addNotificationReceivedListener(onNotificationReceived);
    const response = Notifications.addNotificationResponseReceivedListener(onNotificationResponse);
    return () => {
      received.remove();
      response.remove();
    };
  }
}
