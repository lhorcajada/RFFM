import { Platform } from 'react-native';
import { getOrCreateDeviceId, requestPushToken } from './pushToken';
import { registerPushToken, unregisterPushToken } from './api';
import { navigateFromNotificationData } from './notificationNavigation';
import { getNotificationsModule } from './notificationsClient';

let receivedSubscription: { remove: () => void } | null = null;
let responseSubscription: { remove: () => void } | null = null;

export const initPushNotifications = async (): Promise<void> => {
  try {
    const Notifications = getNotificationsModule();
    if (!Notifications) {
      return;
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const deviceId = await getOrCreateDeviceId();
    const token = await requestPushToken();

    if (token) {
      try {
        await registerPushToken(deviceId, token, Platform.OS as 'ios' | 'android');
      } catch (e) {
        console.error('Failed to register push token:', e);
      }
    }

    receivedSubscription = Notifications.addNotificationReceivedListener(() => {
      Notifications.getBadgeCountAsync().then((count) => Notifications.setBadgeCountAsync(count + 1));
    });

    responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromNotificationData(response.notification.request.content.data as any);
    });

    const lastResponse = await Notifications.getLastNotificationResponseAsync();
    if (lastResponse) {
      navigateFromNotificationData(lastResponse.notification.request.content.data as any);
    }
  } catch (e) {
    console.error('Push notification init failed:', e);
  }
};

export const teardownPushNotifications = async (): Promise<void> => {
  try {
    receivedSubscription?.remove();
    responseSubscription?.remove();
    receivedSubscription = null;
    responseSubscription = null;

    const deviceId = await getOrCreateDeviceId();
    await unregisterPushToken(deviceId);
  } catch (e) {
    console.error('Push notification teardown failed:', e);
  }
};
