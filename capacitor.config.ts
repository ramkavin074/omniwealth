import { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.omniwealth.app',
  appName: 'omniwealth',
  webDir: 'public',
  server: {
    url: 'https://www.omniwealth.org',
    cleartext: true,
    allowNavigation: [
      'www.omniwealth.org',
      'omniwealth.org',
      '*.omniwealth.org'
    ]
  },
  android: {
    webContentsDebuggingEnabled: true
  }
};
export default config;