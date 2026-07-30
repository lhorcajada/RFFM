import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { coachColors } from '../../theme/colors';

/**
 * Cabecera compartida de pantalla (Eventos, Amistosos, Liga, Plantilla, Lesiones,
 * Sanciones…). Renderiza título + botón "volver" + fila de acciones (iconos Ionicons
 * + texto). Evoca el gradiente de título "FC26" (ver --rffm-title-gradient en
 * Front/src/apps/coach/muiCoachTheme.ts) con un acento de dos tonos, sin usar
 * un degradado real.
 */

export interface ScreenHeaderAction {
  key: string;
  icon: string; // Ionicons name, '-outline' suffix expected
  label: string;
  onPress: () => void;
  testID?: string;
}

interface ScreenHeaderProps {
  title: string;
  actions?: ScreenHeaderAction[];
  onBack?: () => void;
  showBack?: boolean;
}

const ScreenHeader = ({ title, actions, onBack, showBack = true }: ScreenHeaderProps) => {
  const navigation = useNavigation();

  const handleBackPress = () => {
    if (onBack) {
      onBack();
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {showBack && (
          <Pressable
            testID="screen-header-back-button"
            onPress={handleBackPress}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back-outline" size={24} color={coachColors.primary} />
          </Pressable>
        )}

        <Text
          testID="screen-header-title"
          style={styles.title}
          numberOfLines={1}
        >
          {title}
        </Text>

        {actions && actions.length > 0 && (
          <View style={styles.actionsRow}>
            {actions.map((action) => (
              <Pressable
                key={action.key}
                testID={action.testID ?? `screen-header-action-${action.key}`}
                onPress={action.onPress}
                style={styles.actionButton}
              >
                <Ionicons name={action.icon} size={20} color={coachColors.primary} />
                <Text style={styles.actionLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.accent}>
        <View style={styles.accentPrimary} />
        <View style={styles.accentSecondary} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    paddingRight: 12,
    paddingVertical: 8,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: coachColors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionLabel: {
    color: coachColors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  accent: {
    flexDirection: 'row',
    height: 3,
    width: 56,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  accentPrimary: {
    flex: 2,
    backgroundColor: coachColors.primary,
  },
  accentSecondary: {
    flex: 1,
    backgroundColor: coachColors.secondary,
  },
});

export default ScreenHeader;
