// Shared CORS for the /api/stocking/* endpoints. The standalone stocking APK's
// WebView runs on a Capacitor localhost origin, so these routes are
// cross-origin for it. They carry no cookies (bearer token in the body), so a
// narrow allow-list is safe. Extra origins via STOCKING_ALLOWED_ORIGINS
// (comma-separated) for staging builds.

const ALLOWED_ORIGINS = new Set(
  [
    'https://localhost',
    'http://localhost',
    'capacitor://localhost',
    ...(process.env.STOCKING_ALLOWED_ORIGINS?.split(',') ?? []),
  ]
    .map((o) => o.trim())
    .filter(Boolean),
);

export function corsHeaders(
  origin: string | null,
  methods = 'POST, OPTIONS',
): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-store-id',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
  }
  return { Vary: 'Origin' };
}

export function corsPreflight(request: Request, methods?: string): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin'), methods),
  });
}
