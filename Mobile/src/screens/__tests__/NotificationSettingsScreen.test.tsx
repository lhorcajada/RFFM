import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import NotificationSettingsScreen from '../NotificationSettingsScreen';
import { getOrCreateDeviceId } from '../../notifications/pushToken';
import { updatePushPreferences } from '../../notifications/api';

jest.mock('../../notifications/pushToken', () => ({
  getOrCreateDeviceId: jest.fn(),
}));
jest.mock('../../notifications/api', () => ({
  updatePushPreferences: jest.fn(),
}));

const mockGetOrCreateDeviceId = getOrCreateDeviceId as jest.Mock;
const mockUpdatePushPreferences = updatePushPreferences as jest.Mock;

describe('NotificationSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOrCreateDeviceId.mockResolvedValue('device-1');
    mockUpdatePushPreferences.mockResolvedValue(undefined);
  });

  it('renders the Noticias and Calendario switches, both on by default', async () => {
    const { getByTestId } = await render(<NotificationSettingsScreen />);

    await waitFor(() => {
      expect(getByTestId('news-switch').props.value).toBe(true);
      expect(getByTestId('calendar-switch').props.value).toBe(true);
    });
  });

  it('toggling a switch and saving calls updatePushPreferences with the new values', async () => {
    const { getByTestId } = await render(<NotificationSettingsScreen />);

    await waitFor(() => expect(getByTestId('news-switch')).toBeTruthy());

    await fireEvent(getByTestId('news-switch'), 'valueChange', false);
    await fireEvent.press(getByTestId('save-button'));

    await waitFor(() => {
      expect(mockUpdatePushPreferences).toHaveBeenCalledWith('device-1', false, true);
    });
  });

  it('shows a Spanish fallback error message when saving fails', async () => {
    mockUpdatePushPreferences.mockRejectedValue(new Error('network error'));

    const { getByTestId, findByTestId } = await render(<NotificationSettingsScreen />);

    await waitFor(() => expect(getByTestId('save-button')).toBeTruthy());
    await fireEvent.press(getByTestId('save-button'));

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage.props.children).toBe('No se pudieron guardar las preferencias');
  });

  it('shows the backend detail message when saving fails with one', async () => {
    mockUpdatePushPreferences.mockRejectedValue({ response: { data: { detail: 'Dispositivo no encontrado' } } });

    const { getByTestId, findByTestId } = await render(<NotificationSettingsScreen />);

    await waitFor(() => expect(getByTestId('save-button')).toBeTruthy());
    await fireEvent.press(getByTestId('save-button'));

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage.props.children).toBe('Dispositivo no encontrado');
  });
});
