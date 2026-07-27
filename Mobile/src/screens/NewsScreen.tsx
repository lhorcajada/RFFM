import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

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
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  placeholder: {
    fontSize: 16,
    color: '#999',
  },
});

export default NewsScreen;
