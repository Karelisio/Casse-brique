import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.karelisio.cassebrique',
  appName: 'Casse-Brique',
  webDir: 'dist',
  backgroundColor: '#07080c',
  android: { allowMixedContent: false },
  ios: { contentInset: 'never' },
};

export default config;
