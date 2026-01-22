"use client";

/**
 * Global error boundary for Next.js App Router
 * This component handles errors that occur in the root layout
 * and must not depend on any context providers that might not be available during build
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ 
          padding: '2rem', 
          fontFamily: 'system-ui, sans-serif',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
            Something went wrong!
          </h1>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            {error.message || 'An unexpected error occurred'}
          </p>
          {error.digest && (
            <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '1rem' }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
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
