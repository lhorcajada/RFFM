import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenHeader from '../shared/components/ScreenHeader';
import TabMenuCard from './components/TabMenuCard';
import { coachColors } from '../theme/colors';

type NavigationProp = NativeStackNavigationProp<any>;

interface MenuItemConfig {
  label: string;
  icon: 'trophy-outline' | 'football-outline' | 'medal-outline';
  target: 'LeagueTab' | 'FriendliesTab' | 'TournamentsTab';
  testID: string;
  includeTeamPlayerId?: boolean;
}

const CompetitionMenuScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const params = (route.params as { teamId?: string; teamPlayerId?: string } | undefined) || {};
  const teamId = params.teamId;
  const teamPlayerId = params.teamPlayerId;

  const menuItems: MenuItemConfig[] = [
    { label: 'Liga', icon: 'trophy-outline', target: 'LeagueTab', testID: 'menu-league' },
    { label: 'Amistosos', icon: 'football-outline', target: 'FriendliesTab', testID: 'menu-friendlies', includeTeamPlayerId: true },
    { label: 'Torneos', icon: 'medal-outline', target: 'TournamentsTab', testID: 'menu-tournaments', includeTeamPlayerId: true },
  ];

  const handleMenuItemPress = (target: string, includeTeamPlayerId?: boolean) => {
    if (includeTeamPlayerId) {
      navigation.navigate(target, { teamId, teamPlayerId });
    } else {
      navigation.navigate(target, { teamId });
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Competición" showBack={false} />
      <View style={styles.menuContainer}>
        {menuItems.map((item) => (
          <TabMenuCard
            key={item.testID}
            label={item.label}
            icon={item.icon}
            onPress={() => handleMenuItemPress(item.target, item.includeTeamPlayerId)}
            testID={item.testID}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: coachColors.background,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  menuContainer: {
    backgroundColor: coachColors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
});

export default CompetitionMenuScreen;
