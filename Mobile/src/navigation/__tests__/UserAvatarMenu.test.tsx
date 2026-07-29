import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import UserAvatarMenu from '../UserAvatarMenu';
import { useAuth } from '../../auth/AuthContext';

jest.mock('../../auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockLogout = jest.fn();

describe('UserAvatarMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogout.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ logout: mockLogout });
  });

  it('renders the avatar button with the menu closed by default', async () => {
    const { getByTestId, queryByTestId } = await render(<UserAvatarMenu />);

    expect(getByTestId('user-avatar-button')).toBeTruthy();
    expect(queryByTestId('user-avatar-menu')).toBeNull();
  });

  it('opens the menu when the avatar is pressed', async () => {
    const { getByTestId, queryByTestId } = await render(<UserAvatarMenu />);

    fireEvent.press(getByTestId('user-avatar-button'));

    await waitFor(() => expect(queryByTestId('user-avatar-menu')).toBeTruthy());
    expect(getByTestId('logout-menu-item')).toBeTruthy();
  });

  it('closes the menu when the avatar is pressed again while open', async () => {
    const { getByTestId, queryByTestId } = await render(<UserAvatarMenu />);

    fireEvent.press(getByTestId('user-avatar-button'));
    await waitFor(() => expect(queryByTestId('user-avatar-menu')).toBeTruthy());

    fireEvent.press(getByTestId('user-avatar-button'));
    await waitFor(() => expect(queryByTestId('user-avatar-menu')).toBeNull());
  });

  it('closes the menu when tapping outside (backdrop press)', async () => {
    const { getByTestId, queryByTestId } = await render(<UserAvatarMenu />);

    fireEvent.press(getByTestId('user-avatar-button'));
    await waitFor(() => expect(queryByTestId('user-avatar-menu')).toBeTruthy());

    fireEvent.press(getByTestId('user-avatar-menu-backdrop'));
    await waitFor(() => expect(queryByTestId('user-avatar-menu')).toBeNull());

    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('calls logout exactly once and closes the menu when "Cerrar sesión" is pressed', async () => {
    const { getByTestId, queryByTestId } = await render(<UserAvatarMenu />);

    fireEvent.press(getByTestId('user-avatar-button'));
    await waitFor(() => expect(queryByTestId('user-avatar-menu')).toBeTruthy());

    fireEvent.press(getByTestId('logout-menu-item'));

    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(queryByTestId('user-avatar-menu')).toBeNull());
  });
});
