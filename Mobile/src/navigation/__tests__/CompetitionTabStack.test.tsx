import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('../../screens/CompetitionMenuScreen', () => 'CompetitionMenuScreen');
jest.mock('../../screens/LeagueScreen', () => 'LeagueScreen');
jest.mock('../../screens/FriendliesScreen', () => 'FriendliesScreen');
jest.mock('../../screens/TournamentsScreen', () => 'TournamentsScreen');
jest.mock('../../screens/CalendarScreen', () => 'CalendarScreen');
jest.mock('../../screens/NewsScreen', () => 'NewsScreen');
jest.mock('../../screens/PlayerSeasonCardsScreen', () => 'PlayerSeasonCardsScreen');
jest.mock('../../screens/InjuriesScreen', () => 'InjuriesScreen');
jest.mock('../../screens/SanctionsScreen', () => 'SanctionsScreen');
jest.mock('../../screens/TeamMenuScreen', () => 'TeamMenuScreen');
jest.mock('../../screens/EventDetailScreen', () => 'EventDetailScreen');
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

import { CompetitionTabStack } from '../RootNavigator';

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
        );
      },
    }),
  };
});

describe('CompetitionTabStack', () => {
  it('registers routes in order: CompetitionMenu, LeagueTab, FriendliesTab, TournamentsTab, EventDetail', async () => {
    const { getAllByTestId } = await render(
      <CompetitionTabStack route={{ params: { teamId: 'team1', teamPlayerId: 'player1' } }} />,
    );

    const allStacks = getAllByTestId(/^stack-screen-/);
    const stackNames = allStacks.map((stack) => stack.props.testID.replace('stack-screen-', ''));

    expect(stackNames).toEqual(['CompetitionMenu', 'LeagueTab', 'FriendliesTab', 'TournamentsTab', 'EventDetail']);
  });

  it('hides the nested native header for EventDetail, since the outer Calendar stack already renders the persistent app header', async () => {
    const { getByTestId } = await render(
      <CompetitionTabStack route={{ params: { teamId: 'team1', teamPlayerId: 'player1' } }} />,
    );

    expect(getByTestId('stack-header-shown-EventDetail').props.children).toBe('false');
  });

  it('forwards teamId and teamPlayerId via initialParams to CompetitionMenu', async () => {
    const { getByTestId } = await render(
      <CompetitionTabStack route={{ params: { teamId: 'team1', teamPlayerId: 'player1' } }} />,
    );

    const params = getByTestId('stack-initial-params-CompetitionMenu').props.children;
    const parsedParams = JSON.parse(params);

    expect(parsedParams.teamId).toBe('team1');
    expect(parsedParams.teamPlayerId).toBe('player1');
  });

  it('forwards teamId via initialParams to LeagueTab', async () => {
    const { getByTestId } = await render(
      <CompetitionTabStack route={{ params: { teamId: 'team1', teamPlayerId: 'player1' } }} />,
    );

    const params = getByTestId('stack-initial-params-LeagueTab').props.children;
    const parsedParams = JSON.parse(params);

    expect(parsedParams.teamId).toBe('team1');
  });

  it('forwards teamId and teamPlayerId via initialParams to FriendliesTab', async () => {
    const { getByTestId } = await render(
      <CompetitionTabStack route={{ params: { teamId: 'team1', teamPlayerId: 'player1' } }} />,
    );

    const params = getByTestId('stack-initial-params-FriendliesTab').props.children;
    const parsedParams = JSON.parse(params);

    expect(parsedParams.teamId).toBe('team1');
    expect(parsedParams.teamPlayerId).toBe('player1');
  });

  it('forwards teamId and teamPlayerId via initialParams to TournamentsTab', async () => {
    const { getByTestId } = await render(
      <CompetitionTabStack route={{ params: { teamId: 'team1', teamPlayerId: 'player1' } }} />,
    );

    const params = getByTestId('stack-initial-params-TournamentsTab').props.children;
    const parsedParams = JSON.parse(params);

    expect(parsedParams.teamId).toBe('team1');
    expect(parsedParams.teamPlayerId).toBe('player1');
  });
});
