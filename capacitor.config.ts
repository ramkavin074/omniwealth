import { CapacitorConfig } from '@capacitor/cli';

// WebView remote-debugging (Chrome DevTools / Safari Web Inspector attach)
// is opt-in for local work only: `CAP_DEBUG=true npx cap sync`.
// A store build must never ship with this on.
const debugWebview = process.env.CAP_DEBUG === 'true';

const config: CapacitorConfig = {
  appId: 'com.omniwealth.app',
  appName: 'omniwealth',
  webDir: 'public',
  server: {
    url: 'https://www.omniwealth.org',
    // Finance app: never allow plaintext HTTP inside the WebView.
    cleartext: false,
    allowNavigation: [
      'www.omniwealth.org',
      'omniwealth.org',
      '*.omniwealth.org'
    ]
  },
  android: {
    webContentsDebuggingEnabled: debugWebview
  },
  ios: {
    webContentsDebuggingEnabled: debugWebview
  }
};

export default config;
