import React from 'react';
import { render } from '@testing-library/react-native';
import { CalendarTabs } from '../RootNavigator';

jest.mock('../../screens/CalendarScreen', () => 'CalendarScreen');
jest.mock('../../screens/NewsScreen', () => 'NewsScreen');
jest.mock('../../screens/PlayerSeasonCardsScreen', () => 'PlayerSeasonCardsScreen');

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
  it('registers an "Estadísticas" PlayersTab alongside CalendarTab and NewsTab', async () => {
    const { getByTestId } = await render(
      <CalendarTabs route={{ params: { teamId: 'team1' } }} />,
    );

    expect(getByTestId('tab-screen-CalendarTab')).toBeTruthy();
    expect(getByTestId('tab-label-CalendarTab').props.children).toBe('Eventos');

    expect(getByTestId('tab-screen-NewsTab')).toBeTruthy();
    expect(getByTestId('tab-label-NewsTab').props.children).toBe('Noticias');

    expect(getByTestId('tab-screen-PlayersTab')).toBeTruthy();
    expect(getByTestId('tab-label-PlayersTab').props.children).toBe('Estadísticas');
  });

  it('uses a statistics icon for the PlayersTab', async () => {
    const { getByTestId } = await render(
      <CalendarTabs route={{ params: { teamId: 'team1' } }} />,
    );

    expect(getByTestId('tab-icon-PlayersTab').props.children).toBe('stats-chart-outline');
  });
});
