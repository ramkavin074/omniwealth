import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportClientError, scrubUrlSecrets, setReportedAppVersion } from './clientErrorReport';

describe('scrubUrlSecrets', () => {
  it('removes query strings, hashes and long path segments (report-link tokens, ids)', () => {
    expect(scrubUrlSecrets('https://x.org/r/Cqxglz-H82onpQbGrCtsBj_kn5KerrROR?invite=abc#top')).toBe('https://x.org/r/:id');
    expect(scrubUrlSecrets('/shop/123e4567-e89b-12d3-a456-426614174000')).toBe('/shop/:id');
    expect(scrubUrlSecrets('/profile')).toBe('/profile');
  });
});

describe('reportClientError', () => {
  const posts: Record<string, unknown>[] = [];
  beforeEach(() => {
    posts.length = 0;
    vi.stubGlobal('window', { location: { pathname: '/r/Cqxglz-H82onpQbGrCtsBj_kn5KerrROR' }, Capacitor: { getPlatform: () => 'android' } });
    vi.stubGlobal('fetch', (_u: string, init: { body: string }) => {
      posts.push(JSON.parse(init.body));
      return Promise.resolve();
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends a scrubbed, platform-tagged report, ignores noise, de-duplicates and caps per load', async () => {
    // fresh module state per test file run: use unique messages
    setReportedAppVersion('24');
    const err = Object.assign(new Error('Failed at https://x.org/r/Cqxglz-H82onpQbGrCtsBj_kn5KerrROR?x=1'), { stack: 'at f (https://x.org/_next/chunk.js?v=9:1:1)' });
    reportClientError('error', err);
    reportClientError('error', err); // duplicate
    reportClientError('error', 'ResizeObserver loop completed with undelivered notifications.'); // noise
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ kind: 'error', platform: 'android', appVersion: '24', path: '/r/:id' });
    expect(String(posts[0].message)).not.toMatch(/Cqxglz/);
    for (let i = 0; i < 10; i++) reportClientError('error', new Error('Distinct ' + i));
    expect(posts.length).toBeLessThanOrEqual(5);
  });
});
