import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.betcouple.app',
  appName: 'Vincit',
  webDir: 'dist',
  android: {
    backgroundColor: '#1a1530',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#1a1530',
    },
  },
};

export default config;
