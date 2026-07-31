import Constants from 'expo-constants';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

let cachedModule: NotificationsModule | null | undefined;

export const isPushUnsupportedInExpoGo = (): boolean =>
  Platform.OS === 'android' && (Constants as any).appOwnership === 'expo';

// expo-notifications removed Android remote push support from Expo Go in SDK 53+.
// Merely importing the package runs a top-level side effect that logs a console.error
// on Android inside Expo Go, regardless of which functions are called — so we avoid
// requiring it at all in that environment rather than trying to suppress the log.
export const getNotificationsModule = (): NotificationsModule | null => {
  if (isPushUnsupportedInExpoGo()) {
    return null;
  }
  if (cachedModule === undefined) {
    cachedModule = require('expo-notifications');
  }
  return cachedModule;
};
