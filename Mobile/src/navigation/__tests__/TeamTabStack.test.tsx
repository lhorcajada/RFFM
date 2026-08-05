import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-notifications', () => ({ setBadgeCountAsync: jest.fn() }));
jest.mock('../../screens/TeamMenuScreen', () => 'TeamMenuScreen');
jest.mock('../../screens/PlayerSeasonCardsScreen', () => 'PlayerSeasonCardsScreen');
jest.mock('../../screens/InjuriesScreen', () => 'InjuriesScreen');
jest.mock('../../screens/SanctionsScreen', () => 'SanctionsScreen');
jest.mock('../../screens/TeamRulesScreen', () => 'TeamRulesScreen');
jest.mock('../../screens/TeamRulesEditScreen', () => 'TeamRulesEditScreen');
jest.mock('../../screens/CalendarScreen', () => 'CalendarScreen');
jest.mock('../../screens/NewsScreen', () => 'NewsScreen');
jest.mock('../../screens/LeagueScreen', () => 'LeagueScreen');
jest.mock('../../screens/FriendliesScreen', () => 'FriendliesScreen');
jest.mock('../../screens/CompetitionMenuScreen', () => 'CompetitionMenuScreen');
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

import { TeamTabStack } from '../RootNavigator';

jest.mock('@react-navigation/native-stack', () => {
  const ReactActual = require('react');
  const { View, Text } = require('react-native');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: any) => ReactActual.createElement(View, { testID: 'stack-navigator' }, children),
      Screen: ({ name, initialParams }: any) => {
        return ReactActual.createElement(
          View,
          { testID: `stack-screen-${name}` },
          ReactActual.createElement(Text, { testID: `stack-initial-params-${name}` }, JSON.stringify(initialParams)),
        );
      },
    }),
  };
});

describe('TeamTabStack', () => {
  it('registers routes in order: TeamMenu, PlayersTab, InjuriesTab, SanctionsTab, RulesTab, TeamRulesEdit', async () => {
    const { getAllByTestId } = await render(
      <TeamTabStack route={{ params: { teamId: 'team1' } }} />,
    );

    const allStacks = getAllByTestId(/^stack-screen-/);
    const stackNames = allStacks.map((stack) => stack.props.testID.replace('stack-screen-', ''));

    expect(stackNames).toEqual([
      'TeamMenu',
      'PlayersTab',
      'InjuriesTab',
      'SanctionsTab',
      'RulesTab',
      'TeamRulesEdit',
    ]);
  });

  it('forwards teamId via initialParams to TeamMenu', async () => {
    const { getByTestId } = await render(
      <TeamTabStack route={{ params: { teamId: 'team1' } }} />,
    );

    const params = getByTestId('stack-initial-params-TeamMenu').props.children;
    const parsedParams = JSON.parse(params);

    expect(parsedParams.teamId).toBe('team1');
  });

  it('forwards teamId via initialParams to PlayersTab', async () => {
    const { getByTestId } = await render(
      <TeamTabStack route={{ params: { teamId: 'team1' } }} />,
    );

    const params = getByTestId('stack-initial-params-PlayersTab').props.children;
    const parsedParams = JSON.parse(params);

    expect(parsedParams.teamId).toBe('team1');
  });

  it('forwards teamId via initialParams to InjuriesTab', async () => {
    const { getByTestId } = await render(
      <TeamTabStack route={{ params: { teamId: 'team1' } }} />,
    );

    const params = getByTestId('stack-initial-params-InjuriesTab').props.children;
    const parsedParams = JSON.parse(params);

    expect(parsedParams.teamId).toBe('team1');
  });

  it('forwards teamId via initialParams to SanctionsTab', async () => {
    const { getByTestId } = await render(
      <TeamTabStack route={{ params: { teamId: 'team1' } }} />,
    );

    const params = getByTestId('stack-initial-params-SanctionsTab').props.children;
    const parsedParams = JSON.parse(params);

    expect(parsedParams.teamId).toBe('team1');
  });

  it('forwards teamId via initialParams to RulesTab', async () => {
    const { getByTestId } = await render(
      <TeamTabStack route={{ params: { teamId: 'team1' } }} />,
    );

    const params = getByTestId('stack-initial-params-RulesTab').props.children;
    const parsedParams = JSON.parse(params);

    expect(parsedParams.teamId).toBe('team1');
  });

  it('forwards teamId via initialParams to TeamRulesEdit', async () => {
    const { getByTestId } = await render(
      <TeamTabStack route={{ params: { teamId: 'team1' } }} />,
    );

    const params = getByTestId('stack-initial-params-TeamRulesEdit').props.children;
    const parsedParams = JSON.parse(params);

    expect(parsedParams.teamId).toBe('team1');
  });
});
