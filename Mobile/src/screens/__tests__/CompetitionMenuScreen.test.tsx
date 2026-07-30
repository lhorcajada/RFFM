import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CompetitionMenuScreen from '../CompetitionMenuScreen';
import { useNavigation, useRoute } from '@react-navigation/native';

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
}));

jest.mock('../../shared/components/ScreenHeader', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return function MockScreenHeader({ title }: any) {
    return React.createElement(
      View,
      { testID: 'screen-header' },
      React.createElement(Text, { testID: 'screen-header-title' }, title),
    );
  };
});

jest.mock('../components/TabMenuCard', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return function MockTabMenuCard({ label, icon, onPress, testID }: any) {
    return React.createElement(
      Pressable,
      { testID, onPress },
      React.createElement(Text, { testID: `${testID}-label` }, label),
      React.createElement(Text, { testID: `${testID}-icon` }, icon),
    );
  };
});

describe('CompetitionMenuScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "Competición" section title', async () => {
    const mockNavigate = jest.fn();
    (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
    (useRoute as jest.Mock).mockReturnValue({ params: { teamId: 'team1', teamPlayerId: 'player1' } });

    const { getByTestId } = await render(<CompetitionMenuScreen />);

    expect(getByTestId('screen-header-title')).toBeTruthy();
    expect(getByTestId('screen-header-title').props.children).toBe('Competición');
  });

  it('renders 3 TabMenuCards with correct labels and icons', async () => {
    const mockNavigate = jest.fn();
    (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
    (useRoute as jest.Mock).mockReturnValue({ params: { teamId: 'team1', teamPlayerId: 'player1' } });

    const { getByTestId } = await render(<CompetitionMenuScreen />);

    // Liga
    expect(getByTestId('menu-league')).toBeTruthy();
    expect(getByTestId('menu-league-label').props.children).toBe('Liga');
    expect(getByTestId('menu-league-icon').props.children).toBe('trophy-outline');

    // Amistosos
    expect(getByTestId('menu-friendlies')).toBeTruthy();
    expect(getByTestId('menu-friendlies-label').props.children).toBe('Amistosos');
    expect(getByTestId('menu-friendlies-icon').props.children).toBe('football-outline');

    // Torneos
    expect(getByTestId('menu-tournaments')).toBeTruthy();
    expect(getByTestId('menu-tournaments-label').props.children).toBe('Torneos');
    expect(getByTestId('menu-tournaments-icon').props.children).toBe('medal-outline');
  });

  it('navigates to LeagueTab with teamId when Liga is pressed', async () => {
    const mockNavigate = jest.fn();
    (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
    (useRoute as jest.Mock).mockReturnValue({ params: { teamId: 'team1', teamPlayerId: 'player1' } });

    const { getByTestId } = await render(<CompetitionMenuScreen />);

    fireEvent.press(getByTestId('menu-league'));

    expect(mockNavigate).toHaveBeenCalledWith('LeagueTab', { teamId: 'team1' });
  });

  it('navigates to FriendliesTab with teamId and teamPlayerId when Amistosos is pressed', async () => {
    const mockNavigate = jest.fn();
    (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
    (useRoute as jest.Mock).mockReturnValue({ params: { teamId: 'team1', teamPlayerId: 'player1' } });

    const { getByTestId } = await render(<CompetitionMenuScreen />);

    fireEvent.press(getByTestId('menu-friendlies'));

    expect(mockNavigate).toHaveBeenCalledWith('FriendliesTab', { teamId: 'team1', teamPlayerId: 'player1' });
  });

  it('navigates to TournamentsTab with teamId and teamPlayerId when Torneos is pressed', async () => {
    const mockNavigate = jest.fn();
    (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
    (useRoute as jest.Mock).mockReturnValue({ params: { teamId: 'team1', teamPlayerId: 'player1' } });

    const { getByTestId } = await render(<CompetitionMenuScreen />);

    fireEvent.press(getByTestId('menu-tournaments'));

    expect(mockNavigate).toHaveBeenCalledWith('TournamentsTab', { teamId: 'team1', teamPlayerId: 'player1' });
  });
});
