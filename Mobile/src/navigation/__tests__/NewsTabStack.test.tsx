import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('../../screens/NewsScreen', () => 'NewsScreen');
jest.mock('../../screens/NewsDetailScreen', () => 'NewsDetailScreen');
jest.mock('../../screens/NewsFormScreen', () => 'NewsFormScreen');
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
// RootNavigator imports CalendarScreen (unmocked here since this suite only covers
// NewsTabStack), which imports expo-notifications for badge clearing on focus.
jest.mock('expo-notifications', () => ({
  setBadgeCountAsync: jest.fn(),
}));

jest.mock('@react-navigation/native-stack', () => {
  const ReactActual = require('react');
  const { View, Text } = require('react-native');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: any) => ReactActual.createElement(View, { testID: 'stack-navigator' }, children),
      Screen: ({ name, options }: any) => {
        const resolvedOptions = typeof options === 'function' ? options({ route: { params: {} } }) : options;
        return ReactActual.createElement(
          View,
          { testID: `stack-screen-${name}` },
          ReactActual.createElement(Text, { testID: `stack-header-shown-${name}` }, String(resolvedOptions?.headerShown)),
          resolvedOptions?.headerTitle !== undefined &&
            ReactActual.createElement(Text, { testID: `stack-has-header-title-${name}` }, String(typeof resolvedOptions.headerTitle === 'function')),
          resolvedOptions?.headerBackVisible !== undefined &&
            ReactActual.createElement(Text, { testID: `stack-header-back-visible-${name}` }, String(resolvedOptions.headerBackVisible)),
        );
      },
    }),
  };
});

import { NewsTabStack } from '../RootNavigator';

describe('NewsTabStack', () => {
  it('registers routes in order: NewsList, NewsDetail, NewsForm', async () => {
    const { getAllByTestId } = await render(<NewsTabStack />);

    const allStacks = getAllByTestId(/^stack-screen-/);
    const stackNames = allStacks.map((stack) => stack.props.testID.replace('stack-screen-', ''));

    expect(stackNames).toEqual(['NewsList', 'NewsDetail', 'NewsForm']);
  });

  it('hides the native header for NewsDetail, which has its own ScreenHeader', async () => {
    const { queryByTestId } = await render(<NewsTabStack />);

    // NewsDetail has no header options, so it inherits headerShown: false from the
    // Navigator's screenOptions — no override testIDs exist for it.
    expect(queryByTestId('stack-has-header-title-NewsDetail')).toBeNull();
    expect(queryByTestId('stack-header-back-visible-NewsDetail')).toBeNull();
  });

  it('hides the native header for NewsForm, which has its own ScreenHeader', async () => {
    const { getByTestId, queryByTestId } = await render(<NewsTabStack />);

    expect(getByTestId('stack-header-shown-NewsForm').props.children).toBe('false');
    // NewsForm has no header options, so these testIDs won't exist
    expect(queryByTestId('stack-has-header-title-NewsForm')).toBeNull();
  });
});
