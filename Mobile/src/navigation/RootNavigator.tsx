import React from 'react';
import { DarkTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import LoginScreen from '../screens/LoginScreen';
import TeamSwitcherScreen from '../screens/TeamSwitcherScreen';
import CalendarScreen from '../screens/CalendarScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import NewsScreen from '../screens/NewsScreen';
import AppHeaderTitle from './AppHeaderTitle';
import UserAvatarMenu from './UserAvatarMenu';
import { useAuth } from '../auth/AuthContext';
import { coachColors } from '../theme/colors';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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

const CalendarTabs = ({ route }: { route: { params?: { teamId?: string; teamPlayerId?: string } } }) => {
  const teamId = route.params?.teamId;
  const teamPlayerId = route.params?.teamPlayerId;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="CalendarTab"
        component={CalendarScreen}
        initialParams={{ teamId, teamPlayerId }}
        options={{
          tabBarLabel: 'Eventos',
        }}
      />
      <Tab.Screen
        name="NewsTab"
        component={NewsScreen}
        options={{
          tabBarLabel: 'Noticias',
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
