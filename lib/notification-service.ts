import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { DatabaseService } from './database-service';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  static async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') {
      console.log('Push notifications not supported on web');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return false;
    }

    return true;
  }

  static async registerForPushNotifications(userId: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return null;
    }

    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      
      await DatabaseService.update('users', userId, {
        pushToken: token
      });

      return token;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  static async sendLocalNotification(
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    if (Platform.OS === 'web') {
      console.log('Local notification:', title, body);
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: null,
    });
  }

  static async notifyDriverAssigned(
    userId: string,
    driverName: string,
    eta: number
  ): Promise<void> {
    await this.sendLocalNotification(
      'Driver Assigned!',
      `${driverName} will arrive in ${eta} minutes`,
      { type: 'driver_assigned' }
    );
  }

  static async notifyDriverArrived(userId: string, driverName: string): Promise<void> {
    await this.sendLocalNotification(
      'Driver Arrived',
      `${driverName} has arrived at your location`,
      { type: 'driver_arrived' }
    );
  }

  static async notifyRideStarted(userId: string): Promise<void> {
    await this.sendLocalNotification(
      'Ride Started',
      'Your ride has started. Have a safe journey!',
      { type: 'ride_started' }
    );
  }

  static async notifyRideCompleted(userId: string, fare: number): Promise<void> {
    await this.sendLocalNotification(
      'Ride Completed',
      `Your ride is complete. Total fare: ₦${fare.toFixed(2)}`,
      { type: 'ride_completed' }
    );
  }

  static async notifyNewRideRequest(
    driverId: string,
    pickupAddress: string,
    fare: number
  ): Promise<void> {
    await this.sendLocalNotification(
      'New Ride Request',
      `Pickup: ${pickupAddress} - Fare: ₦${fare.toFixed(0)}`,
      { type: 'new_ride_request' }
    );
  }

  static setupNotificationListeners(
    onNotificationReceived: (notification: Notifications.Notification) => void,
    onNotificationResponse: (response: Notifications.NotificationResponse) => void
  ): () => void {
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      onNotificationReceived
    );

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      onNotificationResponse
    );

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }
}
