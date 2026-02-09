"use client";

// #region agent log
// Disable static generation - global-error must not be prerendered
export const dynamic = 'force-dynamic';
// #endregion

import { createTranslator, normalizeLocale } from "../lib/i18n";

/**
 * Global error boundary for Next.js App Router
 * 
 * IMPORTANT: This component is rendered OUTSIDE the root layout,
 * so it cannot access any context providers like ThemeRegistry.
 * 
 * WORKAROUND for Next.js 16 prerendering bug:
 * - We use only basic HTML/CSS (no MUI components)
 * - We avoid importing any components that use useContext
 * - We use inline styles instead of theme-dependent styling
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale =
    typeof document !== "undefined"
      ? (() => {
          const cookieLocale = document.cookie
            .split("; ")
            .find((cookie) => cookie.startsWith("audion_locale="))
            ?.split("=")[1];
          if (cookieLocale) return cookieLocale;
          if (typeof navigator !== "undefined") {
            return navigator.language;
          }
          return "en";
        })()
      : "en";
  const t = createTranslator(normalizeLocale(locale));

  // Use a simple function that doesn't require React context
  // This only executes in the browser, never during prerendering
  const handleReset = () => {
    if (typeof window !== 'undefined') {
      if (typeof reset === 'function') {
        try {
          reset();
        } catch (e) {
          // Fallback to page reload if reset fails
          window.location.reload();
        }
      } else {
        window.location.reload();
      }
    }
  };

  // Minimal HTML structure - no MUI imports that could trigger useContext
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`Audion · ${t("error.title")}`}</title>
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ 
          padding: '2rem', 
          fontFamily: 'system-ui, sans-serif',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', marginTop: 0 }}>
            {t("error.title")}
          </h1>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            {error?.message || t("error.subtitle")}
          </p>
          {error?.digest && (
            <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '1rem' }}>
              {t("error.id", { id: error.digest })}
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
            {t("error.cta")}
          </button>
        </div>
      </body>
    </html>
  );
}
