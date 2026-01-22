"use client";

/**
 * Global error boundary for Next.js App Router
 * This component handles errors that occur in the root layout
 * IMPORTANT: Must be a Client Component, but must not use any context providers
 * 
 * This component is rendered OUTSIDE the root layout, so it cannot access
 * any context providers like ThemeRegistry. It must be completely self-contained.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Simple client-side handler - no context dependencies
  const handleReset = () => {
    if (typeof window !== 'undefined') {
      if (typeof reset === 'function') {
        reset();
      } else {
        window.location.reload();
      }
    }
  };

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Error - Audion</title>
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ 
          padding: '2rem', 
          fontFamily: 'system-ui, sans-serif',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: 0 }}>
            Something went wrong!
          </h1>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            {error?.message || 'An unexpected error occurred'}
          </p>
          {error?.digest && (
            <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '1rem' }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={handleReset}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
