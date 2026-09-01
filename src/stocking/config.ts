// Base URL for the few online calls the app makes (one-time login, optional
// barcode name lookup). Empty in dev → relative path → Vite proxy. The
// production APK build has this replaced with the OmniWealth origin by
// vite.config.ts `define`. Everything else in the app is offline-only.
export const API_BASE: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) || '';
