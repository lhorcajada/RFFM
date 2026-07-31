import { api } from '../api/client';

export const registerPushToken = async (
  deviceId: string,
  expoPushToken: string,
  platform: 'ios' | 'android',
): Promise<void> => {
  await api.post('/api/mobile/push-tokens', {
    deviceId,
    expoPushToken,
    platform,
  });
};

export const unregisterPushToken = async (deviceId: string): Promise<void> => {
  await api.delete(`/api/mobile/push-tokens/${deviceId}`);
};

export const updatePushPreferences = async (
  deviceId: string,
  newsEnabled: boolean,
  calendarEnabled: boolean,
): Promise<void> => {
  await api.patch(`/api/mobile/push-tokens/${deviceId}/preferences`, {
    newsEnabled,
    calendarEnabled,
  });
};
