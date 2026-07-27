import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { coachColors } from '../theme/colors';

const NewsScreen = () => {
  return (
    <View style={styles.container}>
      <Text testID="news-title" style={styles.title}>Noticias</Text>
      <Text testID="news-placeholder" style={styles.placeholder}>Próximamente...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: coachColors.background,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: coachColors.textPrimary,
  },
  placeholder: {
    fontSize: 16,
    color: coachColors.textSecondary,
  },
});

export default NewsScreen;
