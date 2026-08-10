import type { ExpoConfig } from 'expo/config';

/**
 * Curated by Mami L — seller dashboard.
 *
 * Firebase web config comes from EXPO_PUBLIC_FIREBASE_* in .env; Expo inlines
 * EXPO_PUBLIC_-prefixed vars at build time, so src/lib/firebase.ts reads them
 * straight off process.env. See .env.example.
 */
const config: ExpoConfig = {
  name: 'Mami L',
  slug: 'dashboard-curatedmamil',
  version: '1.0.0',
  scheme: 'mamil',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.curatedmamil.dashboard',
    infoPlist: {
      // Indonesian copy, matching the rest of the app.
      NSPhotoLibraryUsageDescription:
        'Mami L memerlukan akses galeri untuk menambahkan foto produk.',
    },
  },
  android: {
    package: 'com.curatedmamil.dashboard',
    adaptiveIcon: {
      backgroundColor: '#F3EBE6',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-font',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#F3EBE6',
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Mami L memerlukan akses galeri untuk menambahkan foto produk.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
