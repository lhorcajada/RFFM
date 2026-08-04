import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FutbolBase Mobile',
  slug: 'futbolbase-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  extra: {
    apiBaseUrl: process.env.API_BASE_URL || 'https://localhost:7287',
  },
  plugins: [
    'expo-localization',
    '@react-native-community/datetimepicker',
    'expo-secure-store',
    'expo-status-bar',
    'expo-font',
  ],
  ios: {
    supportsTablet: true,
  },
  android: {
    package: 'com.futbolbase.mobile',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
});
