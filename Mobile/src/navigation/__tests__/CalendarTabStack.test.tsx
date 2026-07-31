import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('../../screens/CalendarScreen', () => 'CalendarScreen');
jest.mock('../../screens/EventDetailScreen', () => 'EventDetailScreen');
jest.mock('../../screens/NewsScreen', () => 'NewsScreen');
jest.mock('../../screens/PlayerSeasonCardsScreen', () => 'PlayerSeasonCardsScreen');
jest.mock('../../screens/LeagueScreen', () => 'LeagueScreen');
jest.mock('../../screens/FriendliesScreen', () => 'FriendliesScreen');
jest.mock('../../screens/InjuriesScreen', () => 'InjuriesScreen');
jest.mock('../../screens/SanctionsScreen', () => 'SanctionsScreen');
jest.mock('../../screens/TeamMenuScreen', () => 'TeamMenuScreen');
jest.mock('../../screens/CompetitionMenuScreen', () => 'CompetitionMenuScreen');
jest.mock('../../screens/TournamentsScreen', () => 'TournamentsScreen');
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

import { CalendarTabStack } from '../RootNavigator';

jest.mock('@react-navigation/native-stack', () => {
  const ReactActual = require('react');
  const { View, Text } = require('react-native');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: any) => ReactActual.createElement(View, { testID: 'stack-navigator' }, children),
      Screen: ({ name, initialParams, options }: any) => {
        const resolvedOptions = typeof options === 'function' ? options({ route: { params: initialParams } }) : options;
        return ReactActual.createElement(
          View,
          { testID: `stack-screen-${name}` },
          ReactActual.createElement(Text, { testID: `stack-initial-params-${name}` }, JSON.stringify(initialParams)),
          resolvedOptions?.headerShown !== undefined &&
            ReactActual.createElement(Text, { testID: `stack-header-shown-${name}` }, String(resolvedOptions.headerShown)),
          resolvedOptions?.headerBackVisible !== undefined &&
            ReactActual.createElement(Text, { testID: `stack-header-back-visible-${name}` }, String(resolvedOptions.headerBackVisible)),
          resolvedOptions?.headerTitle !== undefined &&
            ReactActual.createElement(Text, { testID: `stack-has-header-title-${name}` }, String(typeof resolvedOptions.headerTitle === 'function')),
        );
      },
    }),
  };
});

describe('CalendarTabStack', () => {
  it('registers routes in order: CalendarMain, EventDetail', async () => {
    const { getAllByTestId } = await render(
      <CalendarTabStack route={{ params: { teamId: 'team1', teamPlayerId: 'player1' } }} />,
    );

    const allStacks = getAllByTestId(/^stack-screen-/);
    const stackNames = allStacks.map((stack) => stack.props.testID.replace('stack-screen-', ''));

    expect(stackNames).toEqual(['CalendarMain', 'EventDetail']);
  });

  it('forwards teamId and teamPlayerId via initialParams to CalendarMain', async () => {
    const { getByTestId } = await render(
      <CalendarTabStack route={{ params: { teamId: 'team1', teamPlayerId: 'player1' } }} />,
    );

    const params = JSON.parse(getByTestId('stack-initial-params-CalendarMain').props.children);

    expect(params.teamId).toBe('team1');
    expect(params.teamPlayerId).toBe('player1');
  });

  it('hides the nested native header for EventDetail, since the outer Calendar stack already renders the persistent app header', async () => {
    const { getByTestId } = await render(
      <CalendarTabStack route={{ params: { teamId: 'team1', teamPlayerId: 'player1' } }} />,
    );

    expect(getByTestId('stack-header-shown-EventDetail').props.children).toBe('false');
  });
});
