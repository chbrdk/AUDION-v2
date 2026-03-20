/**
 * Central URL and path configuration.
 * All API and discovery URLs are defined here; never hardcode URLs in other files.
 * @see knowledge/urls-and-discovery.md
 */

const AUDION_API_BASE = 'https://audion.projects-a.plygrnd.tech';

/** CREATION: RAG-backed design composition API (separate service). See github.com/chbrdk/CREATION */
const CREATION_API_BASE = 'https://creation-api.projects-a.plygrnd.tech';

export const URL_CONFIG = {
  /** Default AUDION API base (used when no settings override). */
  AUDION_API_BASE,

  /**
   * AUDION Discovery URL (Opal-format).
   * Nginx mit location /api → .../api/discovery. Nur /api/persona-backend → .../api/persona-backend/discovery.
   */
  AUDION_DISCOVERY_URL: `${AUDION_API_BASE}/api/discovery`,
  AUDION_DISCOVERY_URL_PERSONA_BACKEND: `${AUDION_API_BASE}/api/persona-backend/discovery`,

  /** Optional: Other Opal discovery URL (e.g. Opal hub). When set, tools from that discovery can be used. */
  OPAL_DISCOVERY_URL: '', // Set via settings or env; empty = disabled

  /** CREATION RAG/Compose API base for RAGDesign. Separate service. Overridable via settings.ragApiUrl. */
  RAG_API_BASE: CREATION_API_BASE,
} as const;

/**
 * Path on the CREATION host (same base as {@link URL_CONFIG.RAG_API_BASE}) for the bundled CSS regression HTML.
 * @see CREATION `test-fixtures/html-figma-css-regression.html` served at this path.
 */
export const HTML_FIGMA_CSS_REGRESSION_FIXTURE_PATH =
  "/fixtures/html-figma-css-regression.html" as const;

/** CREATION: prompt → PageSpec → site-preview → capture → layers. Same host as {@link URL_CONFIG.RAG_API_BASE}. */
export const CREATION_GENERATE_SITE_TO_LAYERS_PATH = "/api/v1/generate-site-to-layers" as const;

/** CREATION: journey phase + persona → screen brief + PageSpec user prompt. Same host as {@link URL_CONFIG.RAG_API_BASE}. */
export const CREATION_JOURNEY_SCREEN_BRIEF_PATH = "/api/v1/journey-screen-brief" as const;

/** Debug preview page for generated Prompt→Site jobs (auth required on CREATION). */
export const CREATION_GENERATE_SITE_PREVIEW_PATH = "/api/v1/generate-site-preview" as const;

/** Full URL for the HTML-to-Figma CSS regression fixture (uses your configured CREATION / RAG API base). */
export function getHtmlFigmaCssRegressionFixtureUrl(creationApiBase: string): string {
  const base = creationApiBase.trim().replace(/\/$/, "");
  return `${base}${HTML_FIGMA_CSS_REGRESSION_FIXTURE_PATH}`;
}

export type UrlConfigKey = keyof typeof URL_CONFIG;
