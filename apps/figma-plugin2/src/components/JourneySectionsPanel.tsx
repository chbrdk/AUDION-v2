import React from 'react';
import type { Language } from '../translations';
import { t } from '../translations';
import type { JourneyImportedSectionRow } from '../services/journey-imported-section';
import type { PromptSiteRenderMeta } from '../prompt-site-render-meta';
import { formatPromptSitePdsLines } from '../prompt-site-render-meta';

export type JourneyViewportChoice = 'desktop' | 'tablet' | 'mobile';

export interface JourneySectionsPanelProps {
  lang: Language;
  sections: JourneyImportedSectionRow[];
  selectedNodeId: string | null;
  onSelectSection: (nodeId: string) => void;
  /** True while CREATION + Figma insert runs */
  loading: boolean;
  error: string | null;
  success: boolean;
  previewUrl?: string | null;
  renderMeta?: PromptSiteRenderMeta | null;
  /** Screen prompt from journey brief — required to enable generate */
  promptText: string | null;
  sectionConcepts: unknown[] | null;
  viewport: JourneyViewportChoice;
  onGenerate: (payload: {
    prompt: string;
    viewport: JourneyViewportChoice;
    sectionConcepts?: unknown[];
  }) => void;
  onClearFeedback?: () => void;
}

export function JourneySectionsPanel({
  lang,
  sections,
  selectedNodeId,
  onSelectSection,
  loading,
  error,
  success,
  previewUrl,
  renderMeta,
  promptText,
  sectionConcepts,
  viewport,
  onGenerate,
  onClearFeedback,
}: JourneySectionsPanelProps) {
  const trimmedPrompt = typeof promptText === 'string' ? promptText.trim() : '';
  const canGenerate = trimmedPrompt.length > 0 && !loading;

  const selected = sections.find((s) => s.nodeId === selectedNodeId) ?? null;

  React.useEffect(() => {
    if (error || success) {
      const tmr = window.setTimeout(() => onClearFeedback?.(), success ? 8000 : 12000);
      return () => window.clearTimeout(tmr);
    }
    return undefined;
  }, [error, success, onClearFeedback]);

  const metaLines = formatPromptSitePdsLines(renderMeta ?? null, lang);

  return (
    <div className="msqdx-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div
        className="msqdx-mono"
        style={{ fontSize: '11px', fontWeight: 700, color: 'var(--msqdx-primary)' }}
      >
        {t('journeyImportedSectionsTitle', lang)}
      </div>

      <button
        type="button"
        className="msqdx-button"
        style={{ width: '100%', height: '40px', opacity: canGenerate ? 1 : 0.55 }}
        disabled={!canGenerate}
        onClick={() => {
          onClearFeedback?.();
          onGenerate({
            prompt: trimmedPrompt,
            viewport,
            ...(Array.isArray(sectionConcepts) && sectionConcepts.length > 0
              ? { sectionConcepts }
              : {}),
          });
        }}
      >
        <span className="msqdx-mono" style={{ fontSize: '11px' }}>
          {loading ? t('journeyGenerateFigmaLoading', lang) : t('journeyGenerateFigmaPage', lang)}
        </span>
      </button>
      {!trimmedPrompt && (
        <div className="msqdx-mono" style={{ fontSize: '10px', color: 'var(--msqdx-text-secondary)' }}>
          {t('journeyGenerateFigmaNeedsPrompt', lang)}
        </div>
      )}

      {error && (
        <div
          className="msqdx-mono"
          style={{
            fontSize: '10px',
            color: '#b91c1c',
            padding: '8px',
            borderRadius: '8px',
            background: 'rgba(185, 28, 28, 0.08)',
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div className="msqdx-mono" style={{ fontSize: '10px', color: 'var(--msqdx-text-secondary)' }}>
          {t('promptSiteToFigmaSuccess', lang)}
          {previewUrl ? (
            <>
              {' '}
              <a href={previewUrl} target="_blank" rel="noreferrer">
                Preview
              </a>
            </>
          ) : null}
        </div>
      )}
      {metaLines.length > 0 && (
        <div className="msqdx-mono" style={{ fontSize: '9px', color: 'var(--msqdx-text-secondary)', lineHeight: 1.4 }}>
          {metaLines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {sections.length === 0 ? (
        <p className="msqdx-mono" style={{ fontSize: '10px', color: 'var(--msqdx-text-secondary)', margin: 0, lineHeight: 1.5 }}>
          {t('journeyImportedSectionsEmpty', lang)}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
          {sections.map((row) => {
            const active = row.nodeId === selectedNodeId;
            const title = row.label || row.sectionId;
            return (
              <button
                key={row.nodeId}
                type="button"
                onClick={() => {
                  onSelectSection(row.nodeId);
                  parent.postMessage({ pluginMessage: { type: 'select-scene-node', nodeId: row.nodeId } }, '*');
                }}
                className="msqdx-button secondary"
                style={{
                  width: '100%',
                  height: 'auto',
                  minHeight: '36px',
                  padding: '8px 10px',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  border: active ? '1px solid var(--msqdx-primary)' : undefined,
                  background: active ? 'rgba(99, 102, 241, 0.12)' : undefined,
                }}
              >
                <span className="msqdx-mono" style={{ fontSize: '10px', fontWeight: 700 }}>
                  {title}
                </span>
                <span style={{ fontSize: '10px', opacity: 0.85, marginTop: '4px' }}>{row.summary}</span>
                <span className="msqdx-mono" style={{ fontSize: '9px', opacity: 0.6, marginTop: '4px' }}>
                  {t('journeyImportedSectionsSelectOnCanvas', lang)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div style={{ marginTop: '4px' }}>
          <div className="msqdx-mono" style={{ fontSize: '10px', fontWeight: 700, marginBottom: '6px' }}>
            {t('journeyImportedSectionsDetailHint', lang)}
          </div>
          <pre
            className="msqdx-mono"
            style={{
              margin: 0,
              padding: '10px',
              fontSize: '9px',
              lineHeight: 1.45,
              maxHeight: '220px',
              overflow: 'auto',
              background: 'rgba(0,0,0,0.04)',
              borderRadius: '8px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {selected.detailJson}
          </pre>
        </div>
      )}
    </div>
  );
}
