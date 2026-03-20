import React, { useEffect } from 'react';
import type { Language } from '../translations';
import { t } from '../translations';
import {
  type PromptSiteRenderMeta,
  formatPromptSitePdsLines,
} from '../prompt-site-render-meta';

export type ViewportChoice = 'desktop' | 'tablet' | 'mobile';
export type LibraryChoice = 'default' | 'porsche';
export type ModeChoice = 'production' | 'experimental' | 'free';

export interface PromptSiteToFigmaPanelProps {
  lang: Language;
  loading: boolean;
  error: string | null;
  success: boolean;
  previewUrl?: string | null;
  renderMeta?: PromptSiteRenderMeta | null;
  /** When `prefillToken` changes with a non-empty `prefillPrompt`, the textarea is replaced (e.g. Journey → CREATION brief). */
  prefillPrompt?: string | null;
  /** Bump to re-apply the same prompt text if needed. */
  prefillToken?: number;
  /**
   * Journeys tab: hide library/render-mode; always use default library + free (native LLM).
   */
  journeyPipeline?: boolean;
  onGenerate: (
    prompt: string,
    viewport: ViewportChoice,
    componentLibrary: LibraryChoice,
    renderMode: ModeChoice
  ) => void;
  onClearFeedback?: () => void;
}

export function PromptSiteToFigmaPanel({
  lang,
  loading,
  error,
  success,
  previewUrl,
  renderMeta,
  prefillPrompt,
  prefillToken,
  journeyPipeline = false,
  onGenerate,
  onClearFeedback,
}: PromptSiteToFigmaPanelProps) {
  const [prompt, setPrompt] = React.useState('');
  const [viewport, setViewport] = React.useState<ViewportChoice>('desktop');
  const [componentLibrary, setComponentLibrary] = React.useState<LibraryChoice>('default');
  const [renderMode, setRenderMode] = React.useState<ModeChoice>(() =>
    journeyPipeline ? 'free' : 'production'
  );

  useEffect(() => {
    if (
      prefillToken != null &&
      prefillPrompt != null &&
      typeof prefillPrompt === 'string' &&
      prefillPrompt.length > 0
    ) {
      setPrompt(prefillPrompt);
    }
  }, [prefillToken, prefillPrompt]);

  useEffect(() => {
    if (journeyPipeline) {
      setComponentLibrary('default');
      setRenderMode('free');
    }
  }, [journeyPipeline]);

  useEffect(() => {
    if (error || success) {
      const tid = setTimeout(() => {
        onClearFeedback?.();
      }, 8000);
      return () => clearTimeout(tid);
    }
  }, [error, success, onClearFeedback]);

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    const lib = journeyPipeline ? 'default' : componentLibrary;
    const mode = journeyPipeline ? 'free' : renderMode;
    onGenerate(trimmed, viewport, lib, mode);
  };

  const labelTitle = t('promptSiteToFigmaTitle', lang);
  const labelHint = t('promptSiteToFigmaHint', lang);
  const labelPrompt = t('promptSiteToFigmaPrompt', lang);
  const labelViewport = t('promptSiteToFigmaViewport', lang);
  const labelGo = t('promptSiteToFigmaGenerate', lang);
  const labelLoading = t('promptSiteToFigmaLoading', lang);
  const labelSuccess = t('promptSiteToFigmaSuccess', lang);
  const labelError = error ?? (lang === 'de' ? 'Fehler' : 'Error');

  return (
    <div className="msqdx-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <p style={{ fontSize: '11px', color: 'var(--msqdx-text-secondary)', margin: 0, lineHeight: 1.4 }}>
        <strong style={{ color: 'var(--msqdx-text-primary)' }}>{labelTitle}</strong>
        <br />
        {journeyPipeline ? t('journeyBriefPipelineFixed', lang) : labelHint}
      </p>
      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--msqdx-text-secondary)' }}>
        {labelPrompt}
      </label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={loading}
        rows={5}
        placeholder={lang === 'de' ? 'Beschreibe die gewünschte Landingpage…' : 'Describe the landing page you want…'}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: '8px',
          border: '1px solid var(--msqdx-border-color)',
          fontSize: '13px',
          boxSizing: 'border-box',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--msqdx-text-secondary)' }}>
          {labelViewport}
        </label>
        <select
          value={viewport}
          onChange={(e) => setViewport(e.target.value as ViewportChoice)}
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid var(--msqdx-border-color)',
            fontSize: '13px',
            background: 'rgba(15,23,42,0.03)',
            color: 'var(--msqdx-text-main)',
          }}
        >
          <option value="desktop">Desktop</option>
          <option value="tablet">Tablet</option>
          <option value="mobile">Mobile</option>
        </select>
      </div>
      {!journeyPipeline ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--msqdx-text-secondary)' }}>
              {lang === 'de' ? 'Component Library' : 'Component library'}
            </label>
            <select
              value={componentLibrary}
              onChange={(e) => setComponentLibrary(e.target.value as LibraryChoice)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--msqdx-border-color)',
                fontSize: '13px',
                background: 'rgba(15,23,42,0.03)',
                color: 'var(--msqdx-text-main)',
              }}
            >
              <option value="default">Default</option>
              <option value="porsche">Porsche</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--msqdx-text-secondary)' }}>
              {lang === 'de' ? 'Render Mode' : 'Render mode'}
            </label>
            <select
              value={renderMode}
              onChange={(e) => setRenderMode(e.target.value as ModeChoice)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--msqdx-border-color)',
                fontSize: '13px',
                background: 'rgba(15,23,42,0.03)',
                color: 'var(--msqdx-text-main)',
              }}
            >
              <option value="production">{lang === 'de' ? 'Production' : 'Production'}</option>
              <option value="experimental">{lang === 'de' ? 'Experimental' : 'Experimental'}</option>
              <option value="free">{lang === 'de' ? 'Free (native LLM)' : 'Free (native LLM)'}</option>
            </select>
          </div>
        </>
      ) : null}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || !prompt.trim()}
        className="msqdx-button"
        style={{ width: '100%' }}
      >
        {loading ? labelLoading : labelGo}
      </button>
      {success && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <p style={{ fontSize: '12px', color: 'var(--msqdx-green)', margin: 0 }}>
            {labelSuccess}
          </p>
          {previewUrl ? (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '11px', color: 'var(--msqdx-blue)', textDecoration: 'underline' }}
            >
              {lang === 'de' ? 'Originalseite öffnen' : 'Open original page'}
            </a>
          ) : null}
        </div>
      )}
      {error && (
        <p style={{ fontSize: '11px', color: 'var(--msqdx-orange)', margin: 0, whiteSpace: 'pre-wrap' }}>
          {labelError}
        </p>
      )}
      {previewUrl ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <p style={{ fontSize: '10px', color: 'var(--msqdx-text-secondary)', margin: 0 }}>
            {lang === 'de' ? 'Letzte Preview URL' : 'Latest preview URL'}
          </p>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: '11px',
              color: 'var(--msqdx-blue)',
              textDecoration: 'underline',
              wordBreak: 'break-all',
            }}
          >
            {previewUrl}
          </a>
        </div>
      ) : null}
      {renderMeta ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--msqdx-border-color)', paddingTop: '8px' }}>
          <p style={{ fontSize: '10px', color: 'var(--msqdx-text-secondary)', margin: 0 }}>
            {t('promptSiteToFigmaRendererMeta', lang)}
          </p>
          <p style={{ fontSize: '11px', margin: 0 }}>
            lib: {renderMeta.componentLibrary || '-'} | mode: {renderMeta.renderMode || '-'} | adapter: {renderMeta.adapterUsed || '-'}
          </p>
          <p style={{ fontSize: '11px', margin: 0 }}>
            fallbackCount: {typeof renderMeta.fallbackCount === 'number' ? renderMeta.fallbackCount : '-'}
          </p>
          {formatPromptSitePdsLines(renderMeta, lang).map((line, i) => (
            <p key={`pds-meta-${i}`} style={{ fontSize: '11px', margin: 0, color: 'var(--msqdx-text-secondary)' }}>
              {line}
            </p>
          ))}
          {Array.isArray(renderMeta.fidelityWarnings) && renderMeta.fidelityWarnings.length > 0 ? (
            <p style={{ fontSize: '11px', margin: 0, color: 'var(--msqdx-orange)' }}>
              {renderMeta.fidelityWarnings.map((w) => w?.message).filter(Boolean).join(' | ')}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
