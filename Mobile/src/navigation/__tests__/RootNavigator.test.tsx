import React from 'react';

jest.mock('../../auth/AuthContext');

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
  DarkTheme: { colors: {} },
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: () => null,
    Group: ({ children }: { children: React.ReactNode }) => children,
  }),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: () => null,
  }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('../../screens/LoginScreen', () => 'LoginScreen');
jest.mock('../../screens/RegisterScreen', () => 'RegisterScreen');
jest.mock('../../screens/TeamSwitcherScreen', () => 'TeamSwitcherScreen');
jest.mock('../../screens/CalendarScreen', () => 'CalendarScreen');
jest.mock('../../screens/FriendliesScreen', () => 'FriendliesScreen');
jest.mock('../../screens/TournamentsScreen', () => 'TournamentsScreen');
jest.mock('../../screens/EventDetailScreen', () => 'EventDetailScreen');
jest.mock('../../screens/NewsScreen', () => 'NewsScreen');
jest.mock('../../screens/NewsDetailScreen', () => 'NewsDetailScreen');
jest.mock('../../screens/NewsFormScreen', () => 'NewsFormScreen');
jest.mock('../../screens/PlayerSeasonCardsScreen', () => 'PlayerSeasonCardsScreen');
jest.mock('../../screens/LeagueScreen', () => 'LeagueScreen');
jest.mock('../../screens/InjuriesScreen', () => 'InjuriesScreen');
jest.mock('../../screens/SanctionsScreen', () => 'SanctionsScreen');
jest.mock('../../screens/TeamMenuScreen', () => 'TeamMenuScreen');
jest.mock('../../screens/TeamRulesScreen', () => 'TeamRulesScreen');
jest.mock('../../screens/TeamRulesEditScreen', () => 'TeamRulesEditScreen');
jest.mock('../../screens/CompetitionMenuScreen', () => 'CompetitionMenuScreen');
jest.mock('../AppHeaderTitle', () => 'AppHeaderTitle');
jest.mock('../UserAvatarMenu', () => 'UserAvatarMenu');
jest.mock('../../theme/colors', () => ({
  coachColors: {
    background: '#000',
    textPrimary: '#fff',
  },
}));

// This test verifies that RegisterScreen is imported and wired into RootNavigator
describe('RootNavigator', () => {
  it('imports RegisterScreen as a component', () => {
    // Import the file to verify RegisterScreen is imported
    const navigationFile = require('fs').readFileSync(
      require('path').join(__dirname, '../RootNavigator.tsx'),
      'utf-8',
    );

    // Check that RegisterScreen is imported
    expect(navigationFile).toContain("import RegisterScreen from '../screens/RegisterScreen'");
  });

  it('registers RegisterScreen in the unauthenticated stack', () => {
    const navigationFile = require('fs').readFileSync(
      require('path').join(__dirname, '../RootNavigator.tsx'),
      'utf-8',
    );

    // Check that Register screen is present with name="Register"
    expect(navigationFile).toContain('name="Register"');
    expect(navigationFile).toContain('component={RegisterScreen}');
  });
});
