import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { coachColors } from '../../theme/colors';

interface Props {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  testID: string;
}

const TabMenuCard = ({ label, icon, onPress, testID }: Props) => (
  <Pressable
    testID={testID}
    style={styles.card}
    onPress={onPress}
  >
    <View style={styles.row}>
      <Ionicons
        testID={`${testID}-leading-icon`}
        name={icon}
        size={24}
        color={coachColors.primary}
      />
      <Text
        testID={`${testID}-label`}
        style={styles.label}
      >
        {label}
      </Text>
      <Ionicons
        testID={`${testID}-trailing-icon`}
        name="chevron-forward-outline"
        size={20}
        color={coachColors.textSecondary}
      />
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: coachColors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: coachColors.textPrimary,
  },
});

export default TabMenuCard;
