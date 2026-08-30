import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Conservative baseline security headers. No Content-Security-Policy yet —
// the app relies on inline scripts, third-party analytics, Google Fonts and
// several external API hosts, so a CSP needs its own dedicated pass.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Assumes every *.omniwealth.org host is HTTPS-only. Ignored by browsers
  // over plain http / on localhost. No `preload` (that commitment is
  // submitted separately and is hard to undo).
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: "..",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

// Sentry wraps the config for error/perf monitoring. Source-map upload is
// skipped unless SENTRY_AUTH_TOKEN + org/project are set; the SDK still
// captures errors at runtime whenever SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN
// are present.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  telemetry: false,
});
