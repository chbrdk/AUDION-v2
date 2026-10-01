/**
 * Detect whether AUDION_API_URL points at the Next.js web app instead of FastAPI.
 */

export function isAudionWebHealthPayload(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  // audion-v3 Next /api/health is the assistant target — not a misconfiguration
  if (d.service === 'audion-v3') return false;
  return (
    d.service === 'web' ||
    d.runtime === 'nextjs' ||
    d.app === 'audion-web' ||
    (typeof d.personaBackend === 'object' && d.personaBackend !== null)
  );
}

export function isAudionFastApiHealthPayload(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (isAudionWebHealthPayload(data)) return false;
  return d.status === 'ok' && typeof d.ai_provider_configured === 'boolean';
}

export function audionWebUrlMisconfigMessage(): string {
  return (
    'AUDION_API_URL returned HTML/login instead of JSON. ' +
    'For the Plexon assistant, point audion-mcp at audion-v3 Next: ' +
    'AUDION_API_URL=https://audion-v3.projects-a.plygrnd.tech/api ' +
    '(same token + PLEXON_SERVICE_SECRET as plexon-v3). ' +
    'Do not use FastAPI http://audion-api:8000 for persona list/create/patch.'
  );
}

/** audion-v3 /api/health is a valid assistant target (not a misconfiguration). */
export function isAudionV3HealthPayload(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return d.service === 'audion-v3' || (d.ok === true && d.service === 'audion-v3');
}

export function isHtmlOrLoginBody(contentType: string | null, body: string): boolean {
  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('text/html')) return true;
  const sample = body.slice(0, 400).toLowerCase();
  return (
    sample.includes('/login') ||
    sample.startsWith('<!doctype') ||
    sample.startsWith('<html')
  );
}

export function formatFastApiErrorDetail(detail: unknown): string | undefined {
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'msg' in item) {
          const loc = Array.isArray((item as { loc?: unknown }).loc)
            ? (item as { loc: unknown[] }).loc.join('.')
            : '';
          return loc
            ? `${loc}: ${String((item as { msg?: unknown }).msg ?? '')}`
            : String((item as { msg?: unknown }).msg ?? '');
        }
        return '';
      })
      .filter(Boolean);
    return parts.length ? parts.join('; ') : undefined;
  }
  return undefined;
}
