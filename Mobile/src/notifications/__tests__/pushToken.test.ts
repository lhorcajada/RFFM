import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getOrCreateDeviceId, requestPushToken } from '../pushToken';

jest.mock('expo-secure-store');
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
}));
jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));
jest.mock('expo-constants', () => ({
  expoConfig: { extra: { eas: { projectId: 'test-project-id' } } },
  appOwnership: null,
}));

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockCrypto = Crypto as jest.Mocked<typeof Crypto>;
const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;

describe('getOrCreateDeviceId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the persisted device id when one already exists', async () => {
    (mockSecureStore.getItemAsync as jest.Mock).mockResolvedValue('existing-device-id');

    const deviceId = await getOrCreateDeviceId();

    expect(deviceId).toBe('existing-device-id');
    expect(mockCrypto.randomUUID).not.toHaveBeenCalled();
    expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('creates and persists a new device id when none exists', async () => {
    (mockSecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (mockCrypto.randomUUID as jest.Mock).mockReturnValue('new-device-id');
    (mockSecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

    const deviceId = await getOrCreateDeviceId();

    expect(deviceId).toBe('new-device-id');
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(expect.any(String), 'new-device-id');
  });

  it('returns the same device id on subsequent calls', async () => {
    (mockSecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce('new-device-id');
    (mockCrypto.randomUUID as jest.Mock).mockReturnValue('new-device-id');
    (mockSecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

    const first = await getOrCreateDeviceId();
    const second = await getOrCreateDeviceId();

    expect(first).toBe('new-device-id');
    expect(second).toBe('new-device-id');
  });
});

describe('requestPushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockNotifications.setNotificationChannelAsync as jest.Mock) = jest.fn().mockResolvedValue(undefined);
  });

  it('returns the Expo push token when permission is granted', async () => {
    (mockNotifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, status: 'granted' });
    (mockNotifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'ExponentPushToken[abc123]' });

    const token = await requestPushToken();

    expect(token).toBe('ExponentPushToken[abc123]');
    expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'test-project-id' });
  });

  it('returns null when permission is denied', async () => {
    (mockNotifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false, status: 'denied' });

    const token = await requestPushToken();

    expect(token).toBeNull();
    expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('never throws, returning null when the underlying API rejects', async () => {
    (mockNotifications.requestPermissionsAsync as jest.Mock).mockRejectedValue(new Error('boom'));

    await expect(requestPushToken()).resolves.toBeNull();
  });

  it('skips silently on Android inside Expo Go, without calling the notifications API', async () => {
    (Constants as any).appOwnership = 'expo';
    (Platform as any).OS = 'android';

    const token = await requestPushToken();

    expect(token).toBeNull();
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();

    (Constants as any).appOwnership = null;
  });

  it('does not skip on iOS inside Expo Go (remote push still supported there)', async () => {
    (Constants as any).appOwnership = 'expo';
    (Platform as any).OS = 'ios';
    (mockNotifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, status: 'granted' });
    (mockNotifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'ExponentPushToken[abc123]' });

    const token = await requestPushToken();

    expect(token).toBe('ExponentPushToken[abc123]');

    (Constants as any).appOwnership = null;
    (Platform as any).OS = 'android';
  });
});
