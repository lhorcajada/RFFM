import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import LoginScreen from '../screens/LoginScreen';
import TeamSwitcherScreen from '../screens/TeamSwitcherScreen';
import CalendarScreen from '../screens/CalendarScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import NewsScreen from '../screens/NewsScreen';
import { useAuth } from '../auth/AuthContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
          tabBarLabel: 'Calendario',
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
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
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
                options={{
                  title: 'Calendario',
                }}
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
