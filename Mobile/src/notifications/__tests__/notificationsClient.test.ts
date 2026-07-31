import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getNotificationsModule, isPushUnsupportedInExpoGo } from '../notificationsClient';

jest.mock('expo-notifications', () => ({ __mocked: true }));
jest.mock('expo-constants', () => ({ appOwnership: null }));

describe('notificationsClient', () => {
  afterEach(() => {
    (Constants as any).appOwnership = null;
    (Platform as any).OS = 'ios';
  });

  it('returns the expo-notifications module when not running in Expo Go on Android', () => {
    (Platform as any).OS = 'ios';
    (Constants as any).appOwnership = 'expo';

    expect(isPushUnsupportedInExpoGo()).toBe(false);
    expect(getNotificationsModule()).toEqual({ __mocked: true });
  });

  it('returns null when running in Expo Go on Android', () => {
    (Platform as any).OS = 'android';
    (Constants as any).appOwnership = 'expo';

    expect(isPushUnsupportedInExpoGo()).toBe(true);
    expect(getNotificationsModule()).toBeNull();
  });

  it('returns the module on Android outside Expo Go', () => {
    (Platform as any).OS = 'android';
    (Constants as any).appOwnership = null;

    expect(isPushUnsupportedInExpoGo()).toBe(false);
    expect(getNotificationsModule()).toEqual({ __mocked: true });
  });
});
