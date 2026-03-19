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

export type UrlConfigKey = keyof typeof URL_CONFIG;
