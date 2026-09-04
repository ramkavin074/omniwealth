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
//
// iOS mirrors the above into ./ios-stocking:
//   npm run stocking:add-ios
//   npm run stocking:sync-ios
// `pod install` (CocoaPods) and any build/signing need an actual Mac, but the
// project itself scaffolds fine cross-platform — already done once. Its
// Info.plist already carries the NS*UsageDescription keys the bundled
// plugins need (camera, bluetooth, microphone, speech recognition, Face ID) —
// keep both this app's and the main app's ios/App/App/Info.plist in sync if
// a plugin's permission needs change.

const debugWebview = process.env.CAP_DEBUG === 'true';

const config: CapacitorConfig = {
  appId: 'com.omniwealth.kadai',
  appName: 'OmniWealth Kadai',
  webDir: 'stocking-standalone/dist',
  android: {
    path: 'android-stocking',
    webContentsDebuggingEnabled: debugWebview,
  },
  ios: {
    path: 'ios-stocking',
    webContentsDebuggingEnabled: debugWebview,
  },
};

export default config;
