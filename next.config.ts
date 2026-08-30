import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Content-Security-Policy in REPORT-ONLY mode: nothing is blocked, browsers
// just log what a real CSP would reject (DevTools console). Tighten and
// flip to enforcing `Content-Security-Policy` once the reports are clean.
// External AI / FX / price APIs are called server-side, so they don't need
// connect-src entries here.
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://*.sentry.io https://vitals.vercel-insights.com https://*.vercel-storage.com",
  "frame-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

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
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
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
