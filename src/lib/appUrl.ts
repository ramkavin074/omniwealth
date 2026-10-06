/** The public base URL of the site (APP_URL), with a safe fallback. */
export function appUrl(): string {
  const fallback =
    process.env.NODE_ENV === 'production' ? 'https://www.omniwealth.org' : 'http://localhost:3000';
  const raw = (process.env.APP_URL || '').trim();
  if (!raw) return fallback;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (process.env.NODE_ENV === 'production') u.protocol = 'https:';
    return u.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}
