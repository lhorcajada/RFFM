import { registerPushToken, unregisterPushToken, updatePushPreferences } from '../api';
import { api } from '../../api/client';

jest.mock('../../api/client', () => ({
  api: { post: jest.fn(), delete: jest.fn(), patch: jest.fn() },
}));

const mockApi = api as jest.Mocked<typeof api>;

describe('registerPushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POSTs the device id, expo push token and platform', async () => {
    (mockApi.post as jest.Mock).mockResolvedValue({});

    await registerPushToken('device-1', 'ExponentPushToken[abc]', 'ios');

    expect(mockApi.post).toHaveBeenCalledWith('/api/mobile/push-tokens', {
      deviceId: 'device-1',
      expoPushToken: 'ExponentPushToken[abc]',
      platform: 'ios',
    });
  });

  it('propagates errors from the request', async () => {
    (mockApi.post as jest.Mock).mockRejectedValue(new Error('network error'));

    await expect(registerPushToken('device-1', 'token', 'android')).rejects.toThrow('network error');
  });
});

describe('unregisterPushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('DELETEs by device id', async () => {
    (mockApi.delete as jest.Mock).mockResolvedValue({});

    await unregisterPushToken('device-1');

    expect(mockApi.delete).toHaveBeenCalledWith('/api/mobile/push-tokens/device-1');
  });

  it('propagates errors from the request', async () => {
    (mockApi.delete as jest.Mock).mockRejectedValue(new Error('network error'));

    await expect(unregisterPushToken('device-1')).rejects.toThrow('network error');
  });
});

describe('updatePushPreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('PATCHes the news and calendar preferences', async () => {
    (mockApi.patch as jest.Mock).mockResolvedValue({});

    await updatePushPreferences('device-1', false, true);

    expect(mockApi.patch).toHaveBeenCalledWith('/api/mobile/push-tokens/device-1/preferences', {
      newsEnabled: false,
      calendarEnabled: true,
    });
  });

  it('propagates errors from the request', async () => {
    (mockApi.patch as jest.Mock).mockRejectedValue(new Error('network error'));

    await expect(updatePushPreferences('device-1', true, true)).rejects.toThrow('network error');
  });
});
