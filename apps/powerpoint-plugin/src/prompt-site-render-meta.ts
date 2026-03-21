import type { Language } from './translations';
import { t } from './translations';

/** Subset of CREATION `generate-site-to-layers` response `meta` used in the plugin UI. */
export type CaptureStyleMergeMeta = {
  appliedGradients?: number;
  appliedShadows?: number;
  appliedBlurs?: number;
  appliedTransforms?: number;
  unsupportedTransformHints?: number;
  transformWarningCount?: number;
};

export type PromptSiteRenderMeta = {
  componentLibrary?: string;
  renderMode?: string;
  adapterUsed?: string;
  fallbackCount?: number;
  registryVersion?: string;
  emitterVersion?: string;
  rendererWarnings?: string[];
  captureStyleMerge?: CaptureStyleMergeMeta;
  fidelityWarnings?: Array<{ message?: string }>;
};

/**
 * Short human-readable lines for PDS registry / emitter and capture merge (transform warnings).
 */
export function formatPromptSitePdsLines(
  meta: PromptSiteRenderMeta | null | undefined,
  lang: Language
): string[] {
  if (!meta) return [];
  const lines: string[] = [];
  if (typeof meta.registryVersion === 'string' && meta.registryVersion.trim()) {
    lines.push(`${t('promptSiteToFigmaPdsRegistry', lang)} ${meta.registryVersion}`);
  }
  if (typeof meta.emitterVersion === 'string' && meta.emitterVersion.trim()) {
    lines.push(`${t('promptSiteToFigmaEmitter', lang)} ${meta.emitterVersion}`);
  }
  const cap = summarizeCaptureStyleMerge(meta.captureStyleMerge, lang);
  if (cap) lines.push(cap);
  const rw = meta.rendererWarnings;
  if (Array.isArray(rw) && rw.length > 0) {
    const preview = rw
      .slice(0, 2)
      .map((s) => String(s).trim())
      .filter(Boolean)
      .join(' | ');
    const suffix = rw.length > 2 ? ` (+${rw.length - 2})` : '';
    lines.push(`${t('promptSiteToFigmaEmitterWarnings', lang)} ${preview}${suffix}`);
  }
  return lines;
}

export function summarizeCaptureStyleMerge(
  m: CaptureStyleMergeMeta | undefined,
  lang: Language
): string | null {
  if (!m) return null;
  const tw = m.transformWarningCount;
  if (typeof tw === 'number' && tw > 0) {
    return `${t('promptSiteToFigmaCaptureMerge', lang)} ${tw}`;
  }
  return null;
}
