import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TeamSwitcherScreen from '../TeamSwitcherScreen';
import { api } from '../../api/client';

jest.mock('../../api/client', () => ({
  api: { get: jest.fn() },
}));
jest.mock('expo-secure-store');

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: mockReplace,
    reset: jest.fn(),
  }),
}));

const mockApi = api as jest.Mocked<typeof api>;

describe('TeamSwitcherScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loading indicator before the teams request resolves', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    (mockApi.get as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const { getByTestId, findByTestId } = await render(<TeamSwitcherScreen />);

    expect(getByTestId('loading-indicator')).toBeTruthy();

    resolveRequest({ data: [] });

    await findByTestId('error-message');
  });

  it('shows an empty-state message when the player has no teams', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [] });

    const { findByTestId } = await render(<TeamSwitcherScreen />);

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage.props.children).toBe('No tienes acceso a ningún equipo');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('replaces the screen with Calendar (not navigate) when the player has exactly one team', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({
      data: [{ teamId: 'team1', teamName: 'FC Barcelona', roleId: 1, linkedTeamPlayerId: 'player1' }],
    });

    await render(<TeamSwitcherScreen />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('Calendar', { teamId: 'team1', teamPlayerId: 'player1' }),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renders a selectable list when the player has multiple teams and navigates on press', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({
      data: [
        { teamId: 'team1', teamName: 'FC Barcelona', roleId: 1, linkedTeamPlayerId: 'player1' },
        { teamId: 'team2', teamName: 'Real Madrid', roleId: 2, linkedTeamPlayerId: 'player2' },
      ],
    });

    const { findByTestId, getByTestId, getByText } = await render(<TeamSwitcherScreen />);

    await findByTestId('team-item-team1');
    expect(getByText('FC Barcelona')).toBeTruthy();
    expect(getByText('Real Madrid')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();

    await fireEvent.press(getByTestId('team-item-team2'));

    expect(mockNavigate).toHaveBeenCalledWith('Calendar', { teamId: 'team2', teamPlayerId: 'player2' });
  });

  it('shows the API error message when the teams request fails', async () => {
    (mockApi.get as jest.Mock).mockRejectedValue({
      response: { data: { detail: 'Sesión expirada' } },
    });

    const { findByTestId } = await render(<TeamSwitcherScreen />);

    const errorMessage = await findByTestId('error-message');
    expect(errorMessage.props.children).toBe('Sesión expirada');
  });
});
