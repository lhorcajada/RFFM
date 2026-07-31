import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { api } from '../../api/client';
import { AuthProvider, useAuth } from '../AuthContext';

jest.mock('expo-secure-store');
jest.mock('../../api/client', () => ({
  api: { post: jest.fn() },
  setApiTokenGetter: jest.fn(),
}));

const mockInitPushNotifications = jest.fn();
const mockTeardownPushNotifications = jest.fn();
jest.mock('../../notifications', () => ({
  initPushNotifications: (...args: unknown[]) => mockInitPushNotifications(...args),
  teardownPushNotifications: (...args: unknown[]) => mockTeardownPushNotifications(...args),
}));

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockApi = api as jest.Mocked<typeof api>;

const Probe = () => {
  const { isAuthenticated, error, login, logout, roles } = useAuth();
  return (
    <>
      <Text testID="status">{isAuthenticated ? 'authenticated' : 'anonymous'}</Text>
      {error && <Text testID="error">{error}</Text>}
      <Text testID="roles">{roles.join(',')}</Text>
      <Text testID="login-btn" onPress={() => login('user1', 'pass1').catch(() => {})}>login</Text>
      <Text testID="logout-btn" onPress={() => logout()}>logout</Text>
    </>
  );
};

function base64UrlEncode(json: object): string {
  return Buffer.from(JSON.stringify(json))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function buildFakeToken(payload: object): string {
  const header = base64UrlEncode({ alg: 'HS256', typ: 'JWT' });
  const body = base64UrlEncode(payload);
  return `${header}.${body}.fake-signature`;
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockSecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (mockSecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (mockSecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    mockInitPushNotifications.mockResolvedValue(undefined);
    mockTeardownPushNotifications.mockResolvedValue(undefined);
  });

  it('exposes the roles decoded from the token after login', async () => {
    const token = buildFakeToken({ sub: 'user-1', roles: ['Coach', 'ClubMember'] });
    (mockApi.post as jest.Mock).mockResolvedValue({ data: token });

    const { getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await fireEvent.press(getByTestId('login-btn'));

    await waitFor(() => expect(getByTestId('roles').props.children).toBe('Coach,ClubMember'));
  });

  it('exposes an empty roles array when not authenticated', async () => {
    const { getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(getByTestId('roles').props.children).toBe('');
  });

  it('login success stores the token and flips isAuthenticated to true', async () => {
    (mockApi.post as jest.Mock).mockResolvedValue({ data: 'jwt-token-123' });

    const { getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(getByTestId('status').props.children).toBe('anonymous');

    await fireEvent.press(getByTestId('login-btn'));

    await waitFor(() => expect(getByTestId('status').props.children).toBe('authenticated'));
    expect(mockApi.post).toHaveBeenCalledWith('/api/mobile/login', {
      username: 'user1',
      password: 'pass1',
    });
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'jwt-token-123');
  });

  it('login failure keeps isAuthenticated false and exposes an error message', async () => {
    (mockApi.post as jest.Mock).mockRejectedValue({
      response: { data: { detail: 'Credenciales inválidas' } },
    });

    const { getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await fireEvent.press(getByTestId('login-btn'));

    await waitFor(() => expect(getByTestId('error').props.children).toBe('Credenciales inválidas'));
    expect(getByTestId('status').props.children).toBe('anonymous');
    expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('logout deletes the stored token and flips isAuthenticated to false', async () => {
    (mockApi.post as jest.Mock).mockResolvedValue({ data: 'jwt-token-123' });

    const { getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await fireEvent.press(getByTestId('login-btn'));
    await waitFor(() => expect(getByTestId('status').props.children).toBe('authenticated'));

    await fireEvent.press(getByTestId('logout-btn'));

    await waitFor(() => expect(getByTestId('status').props.children).toBe('anonymous'));
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
  });

  it('calls initPushNotifications on successful login without blocking isAuthenticated from flipping', async () => {
    (mockApi.post as jest.Mock).mockResolvedValue({ data: 'jwt-token-123' });
    let resolveInit: (() => void) | undefined;
    mockInitPushNotifications.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveInit = resolve;
      }),
    );

    const { getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await fireEvent.press(getByTestId('login-btn'));

    await waitFor(() => expect(getByTestId('status').props.children).toBe('authenticated'));
    expect(mockInitPushNotifications).toHaveBeenCalledTimes(1);

    resolveInit?.();
  });

  it('login still succeeds even if initPushNotifications rejects', async () => {
    (mockApi.post as jest.Mock).mockResolvedValue({ data: 'jwt-token-123' });
    mockInitPushNotifications.mockRejectedValue(new Error('push init failed'));

    const { getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await fireEvent.press(getByTestId('login-btn'));

    await waitFor(() => expect(getByTestId('status').props.children).toBe('authenticated'));
  });

  it('awaits teardownPushNotifications before deleting the stored token on logout', async () => {
    (mockApi.post as jest.Mock).mockResolvedValue({ data: 'jwt-token-123' });
    const callOrder: string[] = [];
    mockTeardownPushNotifications.mockImplementation(async () => {
      callOrder.push('teardown');
    });
    (mockSecureStore.deleteItemAsync as jest.Mock).mockImplementation(async () => {
      callOrder.push('deleteToken');
    });

    const { getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await fireEvent.press(getByTestId('login-btn'));
    await waitFor(() => expect(getByTestId('status').props.children).toBe('authenticated'));

    await fireEvent.press(getByTestId('logout-btn'));

    await waitFor(() => expect(getByTestId('status').props.children).toBe('anonymous'));
    expect(mockTeardownPushNotifications).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['teardown', 'deleteToken']);
  });
});
