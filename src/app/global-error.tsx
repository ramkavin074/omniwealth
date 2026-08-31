'use client';

import { useEffect } from 'react';

// Catches errors thrown in the root layout itself (where the normal
// error.tsx boundary can't reach). Must render its own <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error]', error?.message, error?.digest, error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          padding: '0 24px',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#020617',
          color: '#f8fafc',
        }}
      >
        <h1 style={{ fontSize: '18px', margin: 0 }}>OmniWealth couldn&rsquo;t start</h1>
        <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '360px' }}>
          Usually a temporary network problem. Reload to try again.
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: '10px 18px',
            background: '#0f766e',
            color: '#fff',
            border: 0,
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          Reload
        </button>
        {error?.digest && (
          <p style={{ fontSize: '10px', fontFamily: 'monospace', color: '#475569' }}>
            ref: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
