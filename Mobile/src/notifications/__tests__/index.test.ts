const mockSetNotificationHandler = jest.fn();
const mockGetBadgeCountAsync = jest.fn();
const mockSetBadgeCountAsync = jest.fn();
const mockAddNotificationReceivedListener = jest.fn();
const mockAddNotificationResponseReceivedListener = jest.fn();
const mockGetLastNotificationResponseAsync = jest.fn();
const mockRemove = jest.fn();

jest.mock('expo-notifications', () => ({
  setNotificationHandler: (...args: unknown[]) => mockSetNotificationHandler(...args),
  getBadgeCountAsync: (...args: unknown[]) => mockGetBadgeCountAsync(...args),
  setBadgeCountAsync: (...args: unknown[]) => mockSetBadgeCountAsync(...args),
  addNotificationReceivedListener: (...args: unknown[]) => {
    mockAddNotificationReceivedListener(...args);
    return { remove: mockRemove };
  },
  addNotificationResponseReceivedListener: (...args: unknown[]) => {
    mockAddNotificationResponseReceivedListener(...args);
    return { remove: mockRemove };
  },
  getLastNotificationResponseAsync: (...args: unknown[]) => mockGetLastNotificationResponseAsync(...args),
}));

const mockGetOrCreateDeviceId = jest.fn();
const mockRequestPushToken = jest.fn();
jest.mock('../pushToken', () => ({
  getOrCreateDeviceId: (...args: unknown[]) => mockGetOrCreateDeviceId(...args),
  requestPushToken: (...args: unknown[]) => mockRequestPushToken(...args),
}));

const mockRegisterPushToken = jest.fn();
const mockUnregisterPushToken = jest.fn();
jest.mock('../api', () => ({
  registerPushToken: (...args: unknown[]) => mockRegisterPushToken(...args),
  unregisterPushToken: (...args: unknown[]) => mockUnregisterPushToken(...args),
}));

const mockNavigateFromNotificationData = jest.fn();
jest.mock('../notificationNavigation', () => ({
  navigateFromNotificationData: (...args: unknown[]) => mockNavigateFromNotificationData(...args),
}));

import { initPushNotifications, teardownPushNotifications } from '../index';

describe('initPushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOrCreateDeviceId.mockResolvedValue('device-1');
    mockGetLastNotificationResponseAsync.mockResolvedValue(null);
    mockGetBadgeCountAsync.mockResolvedValue(0);
  });

  it('registers the notification handler', async () => {
    mockRequestPushToken.mockResolvedValue('ExponentPushToken[abc]');

    await initPushNotifications();

    expect(mockSetNotificationHandler).toHaveBeenCalled();
  });

  it('requests and registers the push token when permission is granted', async () => {
    mockRequestPushToken.mockResolvedValue('ExponentPushToken[abc]');

    await initPushNotifications();

    expect(mockRegisterPushToken).toHaveBeenCalledWith('device-1', 'ExponentPushToken[abc]', expect.any(String));
  });

  it('does not attempt to register a token when permission is denied', async () => {
    mockRequestPushToken.mockResolvedValue(null);

    await initPushNotifications();

    expect(mockRegisterPushToken).not.toHaveBeenCalled();
  });

  it('sets up received and response listeners', async () => {
    mockRequestPushToken.mockResolvedValue('token');

    await initPushNotifications();

    expect(mockAddNotificationReceivedListener).toHaveBeenCalled();
    expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalled();
  });

  it('checks for a cold-start notification response and navigates from it', async () => {
    mockRequestPushToken.mockResolvedValue('token');
    mockGetLastNotificationResponseAsync.mockResolvedValue({
      notification: { request: { content: { data: { type: 'news', id: 'news-1' } } } },
    });

    await initPushNotifications();

    expect(mockNavigateFromNotificationData).toHaveBeenCalledWith({ type: 'news', id: 'news-1' });
  });

  it('increments the badge count when a notification is received', async () => {
    mockRequestPushToken.mockResolvedValue('token');
    mockGetBadgeCountAsync.mockResolvedValue(2);

    await initPushNotifications();

    const receivedCallback = mockAddNotificationReceivedListener.mock.calls[0][0];
    await receivedCallback({});

    expect(mockSetBadgeCountAsync).toHaveBeenCalledWith(3);
  });

  it('navigates when a notification response is received while the app is running', async () => {
    mockRequestPushToken.mockResolvedValue('token');

    await initPushNotifications();

    const responseCallback = mockAddNotificationResponseReceivedListener.mock.calls[0][0];
    responseCallback({ notification: { request: { content: { data: { type: 'calendar', id: 'e1', teamId: 't1' } } } } });

    expect(mockNavigateFromNotificationData).toHaveBeenCalledWith({ type: 'calendar', id: 'e1', teamId: 't1' });
  });

  it('never throws when the underlying setup fails', async () => {
    mockGetOrCreateDeviceId.mockRejectedValue(new Error('boom'));

    await expect(initPushNotifications()).resolves.toBeUndefined();
  });

  it('never throws when token registration fails', async () => {
    mockRequestPushToken.mockResolvedValue('token');
    mockRegisterPushToken.mockRejectedValue(new Error('network error'));

    await expect(initPushNotifications()).resolves.toBeUndefined();
  });
});

describe('teardownPushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOrCreateDeviceId.mockResolvedValue('device-1');
  });

  it('unregisters the push token for the current device', async () => {
    mockUnregisterPushToken.mockResolvedValue(undefined);

    await teardownPushNotifications();

    expect(mockUnregisterPushToken).toHaveBeenCalledWith('device-1');
  });

  it('never throws when unregistration fails', async () => {
    mockUnregisterPushToken.mockRejectedValue(new Error('network error'));

    await expect(teardownPushNotifications()).resolves.toBeUndefined();
  });
});
