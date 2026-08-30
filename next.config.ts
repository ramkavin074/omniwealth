import type { NextConfig } from "next";

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

export default nextConfig;
