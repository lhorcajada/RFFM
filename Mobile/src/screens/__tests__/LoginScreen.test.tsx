import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';
import { useAuth } from '../../auth/AuthContext';
import { coachColors } from '../../theme/colors';

jest.mock('../../auth/AuthContext');
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockUseAuth = useAuth as jest.Mock;

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('disables the submit button while username or password is empty', async () => {
    mockUseAuth.mockReturnValue({ login: jest.fn() });
    const { getByTestId } = await render(<LoginScreen />);

    const button = getByTestId('login-button');
    expect(button.props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(getByTestId('username-input'), 'player1');
    expect(getByTestId('login-button').props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(getByTestId('password-input'), 'secret');
    expect(getByTestId('login-button').props.accessibilityState.disabled).toBe(false);
  });

  it('renders placeholders with a color visible against the dark background', async () => {
    mockUseAuth.mockReturnValue({ login: jest.fn() });
    const { getByTestId } = await render(<LoginScreen />);

    expect(getByTestId('username-input').props.placeholderTextColor).toBe(coachColors.textSecondary);
    expect(getByTestId('password-input').props.placeholderTextColor).toBe(coachColors.textSecondary);
  });

  it('submits credentials and navigates to TeamSwitcher on success', async () => {
    const login = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ login });
    const { getByTestId } = await render(<LoginScreen />);

    await fireEvent.changeText(getByTestId('username-input'), 'player1');
    await fireEvent.changeText(getByTestId('password-input'), 'secret');
    await fireEvent.press(getByTestId('login-button'));

    await waitFor(() => expect(login).toHaveBeenCalledWith('player1', 'secret'));
    expect(mockNavigate).toHaveBeenCalledWith('TeamSwitcher');
  });

  it('trims leading/trailing whitespace from the username before submitting', async () => {
    const login = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ login });
    const { getByTestId } = await render(<LoginScreen />);

    await fireEvent.changeText(getByTestId('username-input'), ' Lucio ');
    await fireEvent.changeText(getByTestId('password-input'), 'secret');
    await fireEvent.press(getByTestId('login-button'));

    await waitFor(() => expect(login).toHaveBeenCalledWith('Lucio', 'secret'));
  });

  it('shows an error message when login fails and does not navigate', async () => {
    const login = jest.fn().mockRejectedValue({
      response: { data: { detail: 'Credenciales inválidas' } },
    });
    mockUseAuth.mockReturnValue({ login });
    const { getByTestId, findByTestId } = await render(<LoginScreen />);

    await fireEvent.changeText(getByTestId('username-input'), 'player1');
    await fireEvent.changeText(getByTestId('password-input'), 'wrong');
    await fireEvent.press(getByTestId('login-button'));

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage.props.children).toBe('Credenciales inválidas');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
