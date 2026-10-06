import type { MetadataRoute } from 'next';

const BASE_URL = 'https://www.omniwealth.org';

// Fixed dates (not "now"): a lastmod that changes on every request teaches
// search engines to ignore it. Bump these when the page content really changes.
const HOME_UPDATED = new Date('2026-10-04');
const HELP_UPDATED = new Date('2026-09-10');
const LEGAL_UPDATED = new Date('2026-09-04');

// Only pages worth showing in search. /login is a form, not content.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE_URL}/`, lastModified: HOME_UPDATED, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/kadai`, lastModified: new Date('2026-10-06'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/delete-account`, lastModified: new Date('2026-10-06'), changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/help`, lastModified: HELP_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/privacy`, lastModified: LEGAL_UPDATED, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: LEGAL_UPDATED, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
