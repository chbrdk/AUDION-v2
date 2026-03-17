/**
 * Central URL and path configuration.
 * All API and discovery URLs are defined here; never hardcode URLs in other files.
 * @see knowledge/urls-and-discovery.md
 */

export const URL_CONFIG = {
  /** Default AUDION API base (used when no settings override). */
  AUDION_API_BASE: 'https://audion.projects-a.plygrnd.tech',

  /** Optional: Opal (or other) discovery URL. When set, tools/APIs can be resolved from discovery. */
  OPAL_DISCOVERY_URL: '', // Set via settings or env; empty = disabled
} as const;

export type UrlConfigKey = keyof typeof URL_CONFIG;
