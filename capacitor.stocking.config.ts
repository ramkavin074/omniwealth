import { CapacitorConfig } from '@capacitor/cli';

// Standalone offline stocking app. Unlike capacitor.config.ts (which points
// the WebView at the hosted omniwealth.org), this one bundles the built web
// assets into the APK — no `server` block — so the app keeps working with no
// connectivity and can never lose its assets to a WebView cache eviction.
//
// Capacitor CLI 8.x can't be pointed at a non-default config file, so every
// `cap` command for this target goes through scripts/with-stocking-capacitor.mjs,
// which swaps this file in as capacitor.config.ts for the duration and then
// restores the original (the main app's config + ./android are untouched).
//
//   npm run stocking:add-android   # one-time scaffold into ./android-stocking
//   npm run stocking:sync          # build web + copy into ./android-stocking
//   npm run stocking:apk           # sync + assembleDebug
//
// After the one-time scaffold, add the CAMERA permission to
// android-stocking/app/src/main/AndroidManifest.xml.

const debugWebview = process.env.CAP_DEBUG === 'true';

const config: CapacitorConfig = {
  appId: 'com.omniwealth.stocking',
  appName: 'Stock',
  webDir: 'stocking-standalone/dist',
  android: {
    path: 'android-stocking',
    webContentsDebuggingEnabled: debugWebview,
  },
};

export default config;
