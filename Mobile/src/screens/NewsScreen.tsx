import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { coachColors } from '../theme/colors';
import ScreenHeader from '../shared/components/ScreenHeader';

const NewsScreen = () => {
  return (
    <View testID="news-screen-container" style={styles.container}>
      <ScreenHeader title="Noticias" showBack={false} />
      <View style={styles.centeredContent}>
        <Text testID="news-placeholder" style={styles.placeholder}>Próximamente...</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: coachColors.background,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    fontSize: 16,
    color: coachColors.textSecondary,
  },
});

export default NewsScreen;
