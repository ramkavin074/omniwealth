/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute base URL for the one-time login call. Empty in dev (uses the
   *  Vite proxy); set to the OmniWealth origin for production APK builds. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
