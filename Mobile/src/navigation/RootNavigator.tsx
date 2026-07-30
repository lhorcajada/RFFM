import React from 'react';
import { DarkTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import LoginScreen from '../screens/LoginScreen';
import TeamSwitcherScreen from '../screens/TeamSwitcherScreen';
import CalendarScreen from '../screens/CalendarScreen';
import FriendliesScreen from '../screens/FriendliesScreen';
import TournamentsScreen from '../screens/TournamentsScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import NewsScreen from '../screens/NewsScreen';
import PlayerSeasonCardsScreen from '../screens/PlayerSeasonCardsScreen';
import LeagueScreen from '../screens/LeagueScreen';
import InjuriesScreen from '../screens/InjuriesScreen';
import SanctionsScreen from '../screens/SanctionsScreen';
import TeamMenuScreen from '../screens/TeamMenuScreen';
import CompetitionMenuScreen from '../screens/CompetitionMenuScreen';
import AppHeaderTitle from './AppHeaderTitle';
import UserAvatarMenu from './UserAvatarMenu';
import { useAuth } from '../auth/AuthContext';
import { coachColors } from '../theme/colors';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const TeamStack = createNativeStackNavigator();
const CompetitionStack = createNativeStackNavigator();

const rffmCoachNavTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: coachColors.background,
    card: coachColors.surfaceAlt,
    text: coachColors.textPrimary,
    primary: coachColors.primary,
    border: coachColors.border,
  },
};

export const TeamTabStack = ({ route }: { route: { params?: { teamId?: string } } }) => {
  const teamId = route.params?.teamId;

  return (
    <TeamStack.Navigator screenOptions={{ headerShown: false }}>
      <TeamStack.Screen
        name="TeamMenu"
        component={TeamMenuScreen}
        initialParams={{ teamId }}
      />
      <TeamStack.Screen
        name="PlayersTab"
        component={PlayerSeasonCardsScreen}
        initialParams={{ teamId }}
      />
      <TeamStack.Screen
        name="InjuriesTab"
        component={InjuriesScreen}
        initialParams={{ teamId }}
      />
      <TeamStack.Screen
        name="SanctionsTab"
        component={SanctionsScreen}
        initialParams={{ teamId }}
      />
    </TeamStack.Navigator>
  );
};

export const CompetitionTabStack = ({ route }: { route: { params?: { teamId?: string; teamPlayerId?: string } } }) => {
  const teamId = route.params?.teamId;
  const teamPlayerId = route.params?.teamPlayerId;

  return (
    <CompetitionStack.Navigator screenOptions={{ headerShown: false }}>
      <CompetitionStack.Screen
        name="CompetitionMenu"
        component={CompetitionMenuScreen}
        initialParams={{ teamId, teamPlayerId }}
      />
      <CompetitionStack.Screen
        name="LeagueTab"
        component={LeagueScreen}
        initialParams={{ teamId }}
      />
      <CompetitionStack.Screen
        name="FriendliesTab"
        component={FriendliesScreen}
        initialParams={{ teamId, teamPlayerId }}
      />
      <CompetitionStack.Screen
        name="TournamentsTab"
        component={TournamentsScreen}
        initialParams={{ teamId, teamPlayerId }}
      />
    </CompetitionStack.Navigator>
  );
};

export const CalendarTabs = ({ route }: { route: { params?: { teamId?: string; teamPlayerId?: string } } }) => {
  const teamId = route.params?.teamId;
  const teamPlayerId = route.params?.teamPlayerId;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="NewsTab"
        component={NewsScreen}
        options={{
          tabBarLabel: 'Noticias',
          tabBarIcon: ({ color, size }) => <Ionicons name="newspaper-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="CalendarTab"
        component={CalendarScreen}
        initialParams={{ teamId, teamPlayerId }}
        options={{
          tabBarLabel: 'Eventos',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="TeamTab"
        component={TeamTabStack}
        initialParams={{ teamId }}
        options={{
          tabBarLabel: 'Equipo',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="CompetitionTab"
        component={CompetitionTabStack}
        initialParams={{ teamId, teamPlayerId }}
        options={{
          tabBarLabel: 'Competición',
          tabBarIcon: ({ color, size }) => <Ionicons name="podium-outline" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

export const RootNavigator = () => {
  const { isAuthenticated } = useAuth();

  return (
    <NavigationContainer theme={rffmCoachNavTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          headerRight: () => <UserAvatarMenu />,
        }}
      >
        {!isAuthenticated ? (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{
                headerShown: false,
              }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="TeamSwitcher"
              component={TeamSwitcherScreen}
              options={{
                title: 'Seleccionar equipo',
              }}
            />
            <Stack.Group
              screenOptions={{
                presentation: 'modal',
              }}
            >
              <Stack.Screen
                name="Calendar"
                component={CalendarTabs}
                options={({ route }) => ({
                  headerTitle: () => (
                    <AppHeaderTitle teamId={(route.params as { teamId?: string } | undefined)?.teamId} />
                  ),
                })}
              />
              <Stack.Screen
                name="EventDetail"
                component={EventDetailScreen}
                options={{
                  title: 'Detalles del evento',
                }}
              />
            </Stack.Group>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
