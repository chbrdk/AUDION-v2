import React, { useState, useEffect } from 'react';
import type { Language } from '../translations';
import { t } from '../translations';

export interface HtmlToFigmaPanelProps {
  lang: Language;
  loading: boolean;
  error: string | null;
  success: boolean;
  /** Same host as CREATION capture API — used for one-click CSS regression test. */
  regressionFixtureUrl: string;
  onCapture: (url: string) => void;
  onClearFeedback?: () => void;
}

export function HtmlToFigmaPanel({
  lang,
  loading,
  error,
  success,
  regressionFixtureUrl,
  onCapture,
  onClearFeedback,
}: HtmlToFigmaPanelProps) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (error || success) {
      const tid = setTimeout(() => {
        onClearFeedback?.();
      }, 5000);
      return () => clearTimeout(tid);
    }
  }, [error, success, onClearFeedback]);

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onCapture(trimmed);
  };

  const labelLoad =
    lang === 'de'
      ? 'Seite laden und in Figma übertragen'
      : 'Load page and transfer to Figma';
  const labelUrl = lang === 'de' ? 'URL (z. B. https://…)' : 'URL (e.g. https://…)';
  const labelLoading =
    lang === 'de' ? 'Lade Seite…' : 'Loading page…';
  const labelSuccess = lang === 'de' ? 'Seite eingefügt.' : 'Page inserted.';
  const labelError = error ?? (lang === 'de' ? 'Fehler' : 'Error');
  const labelRegression =
    lang === 'de' ? 'CSS-Regression (Testseite)' : 'CSS regression (test page)';
  const hintRegression =
    lang === 'de'
      ? 'Nutzt die Fixture auf deiner RAG-API — CREATION muss dieselbe Base-URL haben.'
      : 'Uses the fixture on your RAG API host — CREATION must match that base URL.';

  return (
    <div className="msqdx-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--msqdx-text-secondary)' }}>
        {labelUrl}
      </label>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com"
        disabled={loading}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: '8px',
          border: '1px solid var(--msqdx-border-color)',
          fontSize: '13px',
          boxSizing: 'border-box',
        }}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || !url.trim()}
        className="msqdx-button"
        style={{ width: '100%' }}
      >
        {loading ? labelLoading : labelLoad}
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button
          type="button"
          onClick={() => onCapture(regressionFixtureUrl)}
          disabled={loading || !regressionFixtureUrl}
          className="msqdx-button secondary"
          style={{ width: '100%', fontSize: '12px' }}
          title={t('htmlToFigmaRegressionHint', lang)}
        >
          {t('htmlToFigmaRegressionButton', lang)}
        </button>
        <p style={{ fontSize: '10px', color: 'var(--msqdx-text-secondary)', margin: 0, lineHeight: 1.35 }}>
          {t('htmlToFigmaRegressionHint', lang)}
        </p>
      </div>
      {success && (
        <p style={{ fontSize: '12px', color: 'var(--msqdx-green)', margin: 0 }}>
          {labelSuccess}
        </p>
      )}
      {error && (
        <p style={{ fontSize: '12px', color: 'var(--msqdx-orange)', margin: 0 }}>
          {labelError}
        </p>
      )}
    </div>
  );
}
