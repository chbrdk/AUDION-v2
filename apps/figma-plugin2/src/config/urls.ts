/**
 * Central URL and path configuration.
 * All API and discovery URLs are defined here; never hardcode URLs in other files.
 * @see knowledge/urls-and-discovery.md
 */

const AUDION_API_BASE = 'https://audion.projects-a.plygrnd.tech';

export const URL_CONFIG = {
  /** Default AUDION API base (used when no settings override). */
  AUDION_API_BASE,

  /**
   * AUDION Discovery URL (Opal-format). AUDION exposes this so it can be registered in Opal.
   * Default: AUDION API base + /.well-known/discovery
   */
  AUDION_DISCOVERY_URL: `${AUDION_API_BASE}/.well-known/discovery`,

  /** Optional: Other Opal discovery URL (e.g. Opal hub). When set, tools from that discovery can be used. */
  OPAL_DISCOVERY_URL: '', // Set via settings or env; empty = disabled
} as const;

export type UrlConfigKey = keyof typeof URL_CONFIG;
