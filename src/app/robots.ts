import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/profile',
          '/vault',
          '/admin',
          '/stocking',
        ],
      },
    ],
    sitemap: 'https://www.omniwealth.org/sitemap.xml',
  };
}
