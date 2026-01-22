/**
 * Global error boundary for Next.js App Router
 * This component handles errors that occur in the root layout
 * IMPORTANT: Must be a SERVER component (no "use client") to avoid useContext issues during build
 * 
 * Disable static generation to prevent prerendering issues
 */
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
          <form action={reset}>
            <button
              type="submit"
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
          </form>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                // Fallback: reload page if form submit doesn't work
                document.querySelector('form')?.addEventListener('submit', function(e) {
                  if (!e.defaultPrevented) {
                    setTimeout(function() {
                      window.location.reload();
                    }, 100);
                  }
                });
              `,
            }}
          />
        </div>
      </body>
    </html>
  );
}
