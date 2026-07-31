import React from 'react';
import { DarkTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import TeamSwitcherScreen from '../screens/TeamSwitcherScreen';
import CalendarScreen from '../screens/CalendarScreen';
import FriendliesScreen from '../screens/FriendliesScreen';
import TournamentsScreen from '../screens/TournamentsScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import NewsScreen from '../screens/NewsScreen';
import NewsDetailScreen from '../screens/NewsDetailScreen';
import NewsFormScreen from '../screens/NewsFormScreen';
import PlayerSeasonCardsScreen from '../screens/PlayerSeasonCardsScreen';
import LeagueScreen from '../screens/LeagueScreen';
import InjuriesScreen from '../screens/InjuriesScreen';
import SanctionsScreen from '../screens/SanctionsScreen';
import TeamMenuScreen from '../screens/TeamMenuScreen';
import TeamRulesScreen from '../screens/TeamRulesScreen';
import CompetitionMenuScreen from '../screens/CompetitionMenuScreen';
import AppHeaderTitle from './AppHeaderTitle';
import UserAvatarMenu from './UserAvatarMenu';
import { useAuth } from '../auth/AuthContext';
import { coachColors } from '../theme/colors';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const TeamStack = createNativeStackNavigator();
const CompetitionStack = createNativeStackNavigator();
const CalendarStack = createNativeStackNavigator();
const NewsStack = createNativeStackNavigator();

const eventDetailScreenOptions = { headerShown: false };

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
      <TeamStack.Screen
        name="RulesTab"
        component={TeamRulesScreen}
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
      <CompetitionStack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        initialParams={{ teamId }}
        options={eventDetailScreenOptions}
      />
    </CompetitionStack.Navigator>
  );
};

export const CalendarTabStack = ({ route }: { route: { params?: { teamId?: string; teamPlayerId?: string } } }) => {
  const teamId = route.params?.teamId;
  const teamPlayerId = route.params?.teamPlayerId;

  return (
    <CalendarStack.Navigator screenOptions={{ headerShown: false }}>
      <CalendarStack.Screen
        name="CalendarMain"
        component={CalendarScreen}
        initialParams={{ teamId, teamPlayerId }}
      />
      <CalendarStack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        initialParams={{ teamId }}
        options={eventDetailScreenOptions}
      />
    </CalendarStack.Navigator>
  );
};

export const NewsTabStack = () => (
  <NewsStack.Navigator screenOptions={{ headerShown: false }}>
    <NewsStack.Screen name="NewsList" component={NewsScreen} />
    <NewsStack.Screen name="NewsDetail" component={NewsDetailScreen} />
    <NewsStack.Screen name="NewsForm" component={NewsFormScreen} options={{ headerShown: false }} />
  </NewsStack.Navigator>
);

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
        component={NewsTabStack}
        options={{
          tabBarLabel: 'Noticias',
          tabBarIcon: ({ color, size }) => <Ionicons name="newspaper-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="CalendarTab"
        component={CalendarTabStack}
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
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
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
            </Stack.Group>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
