import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { coachColors } from '../../theme/colors';

interface Props {
  title: string;
  children?: React.ReactNode;
}

/**
 * Cabecera de sección compartida por las pantallas de listado (Eventos, Amistosos,
 * Liga, Plantilla, Lesiones, Sanciones…). Evoca el gradiente de título "FC26"
 * (ver --rffm-title-gradient en Front/src/apps/coach/muiCoachTheme.ts) con un
 * acento de dos tonos, sin usar un degradado real.
 */
const ScreenSectionHeader = ({ title, children }: Props) => (
  <View style={styles.container}>
    <View style={styles.row}>
      <Text testID="screen-section-title" style={styles.title}>
        {title}
      </Text>
      {children}
    </View>
    <View style={styles.accent}>
      <View style={styles.accentPrimary} />
      <View style={styles.accentSecondary} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: coachColors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
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

export default ScreenSectionHeader;
