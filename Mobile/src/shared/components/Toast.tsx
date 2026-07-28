import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { coachColors } from '../../theme/colors';

export type ToastType = 'error' | 'success' | 'info';

interface Props {
  visible: boolean;
  message: string;
  type?: ToastType;
}

const TYPE_STYLES: Record<ToastType, { backgroundColor: string; color: string }> = {
  error: { backgroundColor: coachColors.error, color: coachColors.contrastText },
  success: { backgroundColor: coachColors.secondary, color: coachColors.contrastText },
  info: { backgroundColor: coachColors.surfaceAlt, color: coachColors.textPrimary },
};

const Toast = ({ visible, message, type = 'info' }: Props) => {
  if (!visible) return null;

  const typeStyle = TYPE_STYLES[type];

  return (
    <View testID="toast" style={[styles.container, { backgroundColor: typeStyle.backgroundColor }]}>
      <Text testID="toast-message" style={[styles.message, { color: typeStyle.color }]}>
        {message}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 32,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default Toast;
