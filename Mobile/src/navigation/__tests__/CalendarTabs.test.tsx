import React from 'react';
import { render } from '@testing-library/react-native';
import { CalendarTabs } from '../RootNavigator';

jest.mock('../../screens/CalendarScreen', () => 'CalendarScreen');
jest.mock('../../screens/NewsScreen', () => 'NewsScreen');
jest.mock('../../screens/PlayerSeasonCardsScreen', () => 'PlayerSeasonCardsScreen');
jest.mock('../../screens/LeagueScreen', () => 'LeagueScreen');
jest.mock('../../screens/FriendliesScreen', () => 'FriendliesScreen');

jest.mock('@react-navigation/bottom-tabs', () => {
  const ReactActual = require('react');
  const { View, Text } = require('react-native');
  return {
    createBottomTabNavigator: () => ({
      Navigator: ({ children }: any) => ReactActual.createElement(View, { testID: 'tab-navigator' }, children),
      Screen: ({ name, options }: any) => {
        const icon = options?.tabBarIcon?.({ color: '#fff', size: 24 });
        return ReactActual.createElement(
          View,
          { testID: `tab-screen-${name}` },
          ReactActual.createElement(Text, { testID: `tab-label-${name}` }, options?.tabBarLabel ?? name),
          ReactActual.createElement(Text, { testID: `tab-icon-${name}` }, icon?.props?.name ?? ''),
        );
      },
    }),
  };
});

describe('CalendarTabs', () => {
  it('registers a "Plantilla" PlayersTab alongside CalendarTab and NewsTab', async () => {
    const { getByTestId } = await render(
      <CalendarTabs route={{ params: { teamId: 'team1' } }} />,
    );

    expect(getByTestId('tab-screen-CalendarTab')).toBeTruthy();
    expect(getByTestId('tab-label-CalendarTab').props.children).toBe('Eventos');

    expect(getByTestId('tab-screen-NewsTab')).toBeTruthy();
    expect(getByTestId('tab-label-NewsTab').props.children).toBe('Noticias');

    expect(getByTestId('tab-screen-PlayersTab')).toBeTruthy();
    expect(getByTestId('tab-label-PlayersTab').props.children).toBe('Plantilla');

    expect(getByTestId('tab-screen-LeagueTab')).toBeTruthy();
    expect(getByTestId('tab-label-LeagueTab').props.children).toBe('Liga');
  });

  it('uses a shirt icon for the PlayersTab', async () => {
    const { getByTestId } = await render(
      <CalendarTabs route={{ params: { teamId: 'team1' } }} />,
    );

    expect(getByTestId('tab-icon-PlayersTab').props.children).toBe('shirt-outline');
  });

  it('uses a trophy icon for the LeagueTab', async () => {
    const { getByTestId } = await render(
      <CalendarTabs route={{ params: { teamId: 'team1' } }} />,
    );

    expect(getByTestId('tab-icon-LeagueTab').props.children).toBe('trophy-outline');
  });

  it('registers a FriendliesTab with label "Amistosos"', async () => {
    const { getByTestId } = await render(
      <CalendarTabs route={{ params: { teamId: 'team1' } }} />,
    );

    expect(getByTestId('tab-screen-FriendliesTab')).toBeTruthy();
    expect(getByTestId('tab-label-FriendliesTab').props.children).toBe('Amistosos');
  });

  it('uses a football icon for the FriendliesTab', async () => {
    const { getByTestId } = await render(
      <CalendarTabs route={{ params: { teamId: 'team1' } }} />,
    );

    expect(getByTestId('tab-icon-FriendliesTab').props.children).toBe('football-outline');
  });

  it('registers tabs in order: NewsTab, CalendarTab, LeagueTab, FriendliesTab, PlayersTab', async () => {
    const { getAllByTestId } = await render(
      <CalendarTabs route={{ params: { teamId: 'team1' } }} />,
    );

    const allTabs = getAllByTestId(/^tab-screen-/);
    const tabNames = allTabs.map((tab) => tab.props.testID.replace('tab-screen-', ''));

    expect(tabNames).toEqual(['NewsTab', 'CalendarTab', 'LeagueTab', 'FriendliesTab', 'PlayersTab']);
  });
});
