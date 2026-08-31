import type { NextConfig } from "next";

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

export default nextConfig;
