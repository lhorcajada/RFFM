import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getNotificationsModule } from './notificationsClient';

const DEVICE_ID_KEY = 'push_device_id';

export const getOrCreateDeviceId = async (): Promise<string> => {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const deviceId = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  return deviceId;
};

const ensureAndroidChannel = async (Notifications: NonNullable<ReturnType<typeof getNotificationsModule>>): Promise<void> => {
  if (Platform.OS !== 'android') {
    return;
  }
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Notificaciones',
    importance: Notifications.AndroidImportance.MAX,
  });
};

export const requestPushToken = async (): Promise<string | null> => {
  try {
    const Notifications = getNotificationsModule();
    if (!Notifications) {
      // expo-notifications removed Android remote push support from Expo Go in SDK 53+;
      // this is expected, not an error, so we skip before ever touching the module.
      return null;
    }

    await ensureAndroidChannel(Notifications);

    const permission = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    if (!permission.granted) {
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;

    const response = await Notifications.getExpoPushTokenAsync({ projectId });
    return response.data;
  } catch (e) {
    console.error('Failed to request push token:', e);
    return null;
  }
};
