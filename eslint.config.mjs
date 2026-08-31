import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Native Capacitor project — generated + third-party JS, not our source.
    "android/**",
    "ios/**",
  ]),
  {
    // Pre-existing debt in this codebase — kept visible as warnings so CI
    // can gate on errors while these get chipped away.
    //  - no-explicit-any: ~110 sites, mostly `props: any` and `catch (e: any)`
    //  - the React Compiler hook rules flag intentional mount-time DOM reads
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
]);

export default eslintConfig;
