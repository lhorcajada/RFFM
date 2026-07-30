import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenSectionHeader from '../shared/components/ScreenSectionHeader';
import TabMenuCard from './components/TabMenuCard';
import { coachColors } from '../theme/colors';

type NavigationProp = NativeStackNavigationProp<any>;

interface MenuItemConfig {
  label: string;
  icon: 'shirt-outline' | 'medkit-outline' | 'warning-outline';
  target: 'PlayersTab' | 'InjuriesTab' | 'SanctionsTab';
  testID: string;
}

const TeamMenuScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const teamId = (route.params as { teamId?: string } | undefined)?.teamId;

  const menuItems: MenuItemConfig[] = [
    { label: 'Plantilla', icon: 'shirt-outline', target: 'PlayersTab', testID: 'menu-players' },
    { label: 'Lesiones', icon: 'medkit-outline', target: 'InjuriesTab', testID: 'menu-injuries' },
    { label: 'Sanciones', icon: 'warning-outline', target: 'SanctionsTab', testID: 'menu-sanctions' },
  ];

  const handleMenuItemPress = (target: string) => {
    navigation.navigate(target, { teamId });
  };

  return (
    <View style={styles.container}>
      <ScreenSectionHeader title="Equipo" />
      <View style={styles.menuContainer}>
        {menuItems.map((item) => (
          <TabMenuCard
            key={item.testID}
            label={item.label}
            icon={item.icon}
            onPress={() => handleMenuItemPress(item.target)}
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

export default TeamMenuScreen;
