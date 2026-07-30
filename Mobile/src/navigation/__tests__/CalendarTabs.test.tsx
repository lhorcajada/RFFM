import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('../../screens/CalendarScreen', () => 'CalendarScreen');
jest.mock('../../screens/NewsScreen', () => 'NewsScreen');
jest.mock('../../screens/PlayerSeasonCardsScreen', () => 'PlayerSeasonCardsScreen');
jest.mock('../../screens/LeagueScreen', () => 'LeagueScreen');
jest.mock('../../screens/FriendliesScreen', () => 'FriendliesScreen');
jest.mock('../../screens/InjuriesScreen', () => 'InjuriesScreen');
jest.mock('../../screens/SanctionsScreen', () => 'SanctionsScreen');
jest.mock('../../screens/TeamMenuScreen', () => 'TeamMenuScreen');
jest.mock('../../screens/CompetitionMenuScreen', () => 'CompetitionMenuScreen');
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

import { CalendarTabs, TeamTabStack, CompetitionTabStack } from '../RootNavigator';

jest.mock('@react-navigation/bottom-tabs', () => {
  const ReactActual = require('react');
  const { View, Text } = require('react-native');
  return {
    createBottomTabNavigator: () => ({
      Navigator: ({ children }: any) => ReactActual.createElement(View, { testID: 'tab-navigator' }, children),
      Screen: ({ name, component, options }: any) => {
        const icon = options?.tabBarIcon?.({ color: '#fff', size: 24 });
        // Render the component even if it's a navigator
        const Screen = component;
        return ReactActual.createElement(
          View,
          { testID: `tab-screen-${name}` },
          ReactActual.createElement(Text, { testID: `tab-label-${name}` }, options?.tabBarLabel ?? name),
          ReactActual.createElement(Text, { testID: `tab-icon-${name}` }, icon?.props?.name ?? ''),
          ReactActual.createElement(View, { testID: `tab-component-${name}` }),
        );
      },
    }),
  };
});

describe('CalendarTabs', () => {
  it('registers NewsTab and CalendarTab', async () => {
    const { getByTestId } = await render(
      <CalendarTabs route={{ params: { teamId: 'team1' } }} />,
    );

    expect(getByTestId('tab-screen-NewsTab')).toBeTruthy();
    expect(getByTestId('tab-label-NewsTab').props.children).toBe('Noticias');

    expect(getByTestId('tab-screen-CalendarTab')).toBeTruthy();
    expect(getByTestId('tab-label-CalendarTab').props.children).toBe('Eventos');
  });

  it('uses a newspaper icon for the NewsTab', async () => {
    const { getByTestId } = await render(
      <CalendarTabs route={{ params: { teamId: 'team1' } }} />,
    );

    expect(getByTestId('tab-icon-NewsTab').props.children).toBe('newspaper-outline');
  });

  it('uses a calendar icon for the CalendarTab', async () => {
    const { getByTestId } = await render(
      <CalendarTabs route={{ params: { teamId: 'team1' } }} />,
    );

    expect(getByTestId('tab-icon-CalendarTab').props.children).toBe('calendar-outline');
  });

  it('registers a TeamTab with label "Equipo"', async () => {
    const { getByTestId } = await render(
      <CalendarTabs route={{ params: { teamId: 'team1' } }} />,
    );

    expect(getByTestId('tab-screen-TeamTab')).toBeTruthy();
    expect(getByTestId('tab-label-TeamTab').props.children).toBe('Equipo');
  });

  it('uses a people icon for the TeamTab', async () => {
    const { getByTestId } = await render(
      <CalendarTabs route={{ params: { teamId: 'team1' } }} />,
    );

    expect(getByTestId('tab-icon-TeamTab').props.children).toBe('people-outline');
  });

  it('registers a CompetitionTab with label "Competición"', async () => {
    const { getByTestId } = await render(
      <CalendarTabs route={{ params: { teamId: 'team1' } }} />,
    );

    expect(getByTestId('tab-screen-CompetitionTab')).toBeTruthy();
    expect(getByTestId('tab-label-CompetitionTab').props.children).toBe('Competición');
  });

  it('uses a podium icon for the CompetitionTab', async () => {
    const { getByTestId } = await render(
      <CalendarTabs route={{ params: { teamId: 'team1' } }} />,
    );

    expect(getByTestId('tab-icon-CompetitionTab').props.children).toBe('podium-outline');
  });

  it('registers tabs in order: NewsTab, CalendarTab, TeamTab, CompetitionTab', async () => {
    const { getAllByTestId } = await render(
      <CalendarTabs route={{ params: { teamId: 'team1' } }} />,
    );

    const allTabs = getAllByTestId(/^tab-screen-/);
    const tabNames = allTabs.map((tab) => tab.props.testID.replace('tab-screen-', ''));

    expect(tabNames).toEqual(['NewsTab', 'CalendarTab', 'TeamTab', 'CompetitionTab']);
  });
});
