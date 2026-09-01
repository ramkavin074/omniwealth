import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/postcss';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// Standalone build of the stocking module. Ships as bundled assets inside the
// com.omniwealth.stocking Capacitor APK — no dev server, no server.url, works
// with the radio off. `base: './'` keeps asset URLs relative for the WebView.
export default defineConfig(({ mode }) => {
  // Where the one-time login call goes. Inside the bundled APK there is no
  // server at the app's own origin, so the production build needs an absolute
  // URL. Dev leaves it empty and relies on the proxy below.
  //   override: VITE_API_BASE=https://staging.example.com npm run stocking:build
  const apiBase =
    process.env.VITE_API_BASE ??
    (mode === 'production' ? 'https://www.omniwealth.org' : '');

  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    base: './',
    define: {
      'import.meta.env.VITE_API_BASE': JSON.stringify(apiBase),
    },
    resolve: {
      alias: { '@': `${repoRoot}src` },
    },
    css: {
      postcss: { plugins: [tailwind()] },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        // The screen components keep their "use client" directive because they
        // are also imported by the in-OmniWealth Next host. Harmless here.
        onwarn(warning, warn) {
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
          if (
            warning.code === 'SOURCEMAP_ERROR' &&
            warning.message.includes("Can't resolve original location")
          ) {
            return;
          }
          warn(warning);
        },
      },
    },
    server: {
      port: 5199,
      // Proxy the auth check to the running Next app during local dev so the
      // login screen works without CORS juggling.
      proxy: {
        '/api/stocking': 'http://localhost:3000',
      },
    },
  };
});
