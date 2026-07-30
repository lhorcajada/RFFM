import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TeamMenuScreen from '../TeamMenuScreen';
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

describe('TeamMenuScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "Equipo" section title', async () => {
    const mockNavigate = jest.fn();
    (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
    (useRoute as jest.Mock).mockReturnValue({ params: { teamId: 'team1' } });

    const { getByTestId } = await render(<TeamMenuScreen />);

    expect(getByTestId('screen-header-title')).toBeTruthy();
    expect(getByTestId('screen-header-title').props.children).toBe('Equipo');
  });

  it('renders 4 TabMenuCards with correct labels and icons', async () => {
    const mockNavigate = jest.fn();
    (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
    (useRoute as jest.Mock).mockReturnValue({ params: { teamId: 'team1' } });

    const { getByTestId } = await render(<TeamMenuScreen />);

    // Plantilla
    expect(getByTestId('menu-players')).toBeTruthy();
    expect(getByTestId('menu-players-label').props.children).toBe('Plantilla');
    expect(getByTestId('menu-players-icon').props.children).toBe('shirt-outline');

    // Lesiones
    expect(getByTestId('menu-injuries')).toBeTruthy();
    expect(getByTestId('menu-injuries-label').props.children).toBe('Lesiones');
    expect(getByTestId('menu-injuries-icon').props.children).toBe('medkit-outline');

    // Sanciones
    expect(getByTestId('menu-sanctions')).toBeTruthy();
    expect(getByTestId('menu-sanctions-label').props.children).toBe('Sanciones');
    expect(getByTestId('menu-sanctions-icon').props.children).toBe('warning-outline');

    // Normas del equipo
    expect(getByTestId('menu-rules')).toBeTruthy();
    expect(getByTestId('menu-rules-label').props.children).toBe('Normas del equipo');
    expect(getByTestId('menu-rules-icon').props.children).toBe('document-text-outline');
  });

  it('navigates to PlayersTab with teamId when Plantilla is pressed', async () => {
    const mockNavigate = jest.fn();
    (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
    (useRoute as jest.Mock).mockReturnValue({ params: { teamId: 'team1' } });

    const { getByTestId } = await render(<TeamMenuScreen />);

    fireEvent.press(getByTestId('menu-players'));

    expect(mockNavigate).toHaveBeenCalledWith('PlayersTab', { teamId: 'team1' });
  });

  it('navigates to InjuriesTab with teamId when Lesiones is pressed', async () => {
    const mockNavigate = jest.fn();
    (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
    (useRoute as jest.Mock).mockReturnValue({ params: { teamId: 'team1' } });

    const { getByTestId } = await render(<TeamMenuScreen />);

    fireEvent.press(getByTestId('menu-injuries'));

    expect(mockNavigate).toHaveBeenCalledWith('InjuriesTab', { teamId: 'team1' });
  });

  it('navigates to SanctionsTab with teamId when Sanciones is pressed', async () => {
    const mockNavigate = jest.fn();
    (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
    (useRoute as jest.Mock).mockReturnValue({ params: { teamId: 'team1' } });

    const { getByTestId } = await render(<TeamMenuScreen />);

    fireEvent.press(getByTestId('menu-sanctions'));

    expect(mockNavigate).toHaveBeenCalledWith('SanctionsTab', { teamId: 'team1' });
  });

  it('navigates to RulesTab with teamId when Normas del equipo is pressed', async () => {
    const mockNavigate = jest.fn();
    (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
    (useRoute as jest.Mock).mockReturnValue({ params: { teamId: 'team1' } });

    const { getByTestId } = await render(<TeamMenuScreen />);

    fireEvent.press(getByTestId('menu-rules'));

    expect(mockNavigate).toHaveBeenCalledWith('RulesTab', { teamId: 'team1' });
  });
});
