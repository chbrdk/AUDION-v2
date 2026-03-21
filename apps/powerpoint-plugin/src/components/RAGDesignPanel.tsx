import React, { useState, useEffect } from 'react';
import { t, Language } from '../translations';
import {
  composeDesign,
  getMockComposition,
  crawlLibrary,
  addComponentsToRAG,
  rateComposition,
  resetCreationDb,
  type CompositionJSON,
  type ComposeResponse,
  type ViewportType,
} from '../api/rag-compose-client';
import type { RAGComponentPayload } from '../services/rag-selection-service';

/** Extract Figma file key from URL or return trimmed input as key. */
function extractFileKeyFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/figma\.com\/(?:design|file)\/([A-Za-z0-9]+)/);
  if (match) return match[1];
  return trimmed;
}

interface RAGDesignPanelProps {
  lang: Language;
  ragApiUrl: string;
  projectId?: string;
  getFileKey: () => Promise<string | null>;
  ragComponents?: RAGComponentPayload[] | null;
  ragFileKey?: string;
  /** LLM-inferred metadata from last "Auswahl laden" (Stil, Tags, Einsatz). Pre-fills the three inputs. */
  inferredFromSelection?: { aestheticStyle?: string; commonContexts?: string[]; usageHint?: string } | null;
  onLoadRAGComponents?: () => void;
  onComposeSuccess: () => void;
  onComposeError: (error: string) => void;
  onRender: (
    composition: CompositionJSON,
    resolvedKeys: Record<string, string>,
    resolvedTypes?: Record<string, 'component' | 'component_set'>
  ) => void;
  isRendering: boolean;
  renderError: string | null;
  renderSuccess: boolean;
  hasApiKey?: boolean;
  isRefining?: boolean;
  refineProgress?: string | null;
  refineError?: string | null;
  onRefineLayout?: () => void;
  onCheckLayout?: () => void;
  layoutFeedback?: string | null;
  layoutCheckInProgress?: boolean;
  layoutCheckError?: string | null;
}

export function RAGDesignPanel({
  lang,
  ragApiUrl,
  projectId,
  getFileKey,
  ragComponents,
  ragFileKey = 'plugin-selection',
  inferredFromSelection,
  onLoadRAGComponents,
  onComposeSuccess,
  onComposeError,
  onRender,
  isRendering,
  renderError,
  renderSuccess,
  hasApiKey = false,
  isRefining = false,
  refineProgress = null,
  refineError = null,
  onRefineLayout,
  onCheckLayout,
  layoutFeedback = null,
  layoutCheckInProgress = false,
  layoutCheckError = null,
}: RAGDesignPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [projectIdInput, setProjectIdInput] = useState(projectId ?? '');
  const [isComposing, setIsComposing] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ComposeResponse | null>(null);
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlResult, setCrawlResult] = useState<string | null>(null);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [fileKeyInput, setFileKeyInput] = useState('');
  const [isAddingToRag, setIsAddingToRag] = useState(false);
  const [addResult, setAddResult] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [isResettingDb, setIsResettingDb] = useState(false);
  const [resetDbResult, setResetDbResult] = useState<string | null>(null);
  const [resetDbError, setResetDbError] = useState<string | null>(null);
  const [designSystemInput, setDesignSystemInput] = useState('');
  const [aestheticStyleInput, setAestheticStyleInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [usageHintInput, setUsageHintInput] = useState('');
  const [viewport, setViewport] = useState<ViewportType>('desktop');
  const [preferences, setPreferences] = useState('');
  const [ratingSent, setRatingSent] = useState<'up' | 'down' | null>(null);

  // Pre-fill Stil, Tags, Einsatz when LLM inferred metadata arrives after "Auswahl laden"
  useEffect(() => {
    if (!inferredFromSelection) return;
    if (inferredFromSelection.aestheticStyle != null) setAestheticStyleInput(inferredFromSelection.aestheticStyle);
    if (inferredFromSelection.commonContexts?.length) setTagsInput(inferredFromSelection.commonContexts.join(', '));
    if (inferredFromSelection.usageHint != null) setUsageHintInput(inferredFromSelection.usageHint);
  }, [inferredFromSelection]);

  const handleCompose = async () => {
    if (!prompt.trim()) return;
    setIsComposing(true);
    setComposeError(null);
    try {
      let result: ComposeResponse;
      try {
        result = await composeDesign(ragApiUrl, {
          prompt: prompt.trim(),
          projectId: projectIdInput.trim() || undefined,
          viewport,
          ...(preferences.trim() && { preferences: preferences.trim() }),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Fallback to mock when backend unreachable (network/CORS/5xx). See getMockComposition in rag-compose-client.ts for "Mock composition: RAG backend not available".
        if (
          msg.includes('Failed to fetch') ||
          msg.includes('NetworkError') ||
          msg.includes('404') ||
          msg.includes('500') ||
          msg.includes('502') ||
          msg.includes('Bad Gateway')
        ) {
          result = getMockComposition(prompt.trim());
          setComposeError(lang === 'de' ? `RAG-Backend nicht erreichbar: ${msg}` : `RAG backend unavailable: ${msg}`);
        } else {
          throw err;
        }
      }
      setLastResult(result);
      setRatingSent(null);
      onComposeSuccess();
      onRender(result.composition, result.resolvedKeys, result.resolvedTypes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setComposeError(msg);
      onComposeError(msg);
    } finally {
      setIsComposing(false);
    }
  };

  const handleRenderLast = () => {
    if (lastResult) {
      onRender(lastResult.composition, lastResult.resolvedKeys, lastResult.resolvedTypes);
    }
  };

  const handleCrawl = async () => {
    const projId = projectIdInput.trim();
    if (!projId) {
      setCrawlError(t('crawlErrorNoProject', lang));
      return;
    }
    setIsCrawling(true);
    setCrawlError(null);
    setCrawlResult(null);
    try {
      const raw = fileKeyInput.trim();
      let fileKey: string | null = raw ? extractFileKeyFromInput(raw) : null;
      if (!fileKey) fileKey = await getFileKey();
      if (!fileKey) {
        setCrawlError(t('crawlErrorNoFile', lang));
        setIsCrawling(false);
        return;
      }
      const result = await crawlLibrary(ragApiUrl, {
        projectId: projId,
        fileKey,
        includeThumbnails: true,
        enrichWithVision: true,
      });
      if (result.textLayersByComponent?.length) {
        console.log('[RAG Design] Vision/Text-Layers:', result.textLayersByComponent);
      }
      const msg =
        lang === 'de'
          ? `${result.componentCount} Komponenten, ${result.componentSetCount} Sets in ${(result.durationMs / 1000).toFixed(1)}s`
          : `${result.componentCount} components, ${result.componentSetCount} sets in ${(result.durationMs / 1000).toFixed(1)}s`;
      setCrawlResult(msg);
    } catch (err) {
      setCrawlError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCrawling(false);
    }
  };

  const handleLoadRAGComponents = () => {
    onLoadRAGComponents?.();
  };

  const handleAddToRAG = async () => {
    const projId = projectIdInput.trim();
    if (!projId) {
      setAddError(t('addErrorNoProject', lang));
      return;
    }
    if (!ragComponents || ragComponents.length === 0) {
      setAddError(t('addErrorNoSelection', lang));
      return;
    }
    setIsAddingToRag(true);
    setAddError(null);
    setAddResult(null);
    try {
      const raw = fileKeyInput.trim();
      const fileKey = raw ? (extractFileKeyFromInput(raw) ?? ragFileKey) : ragFileKey;
      const commonContexts = tagsInput.trim()
        ? tagsInput.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;
      const result = await addComponentsToRAG(ragApiUrl, {
        projectId: projId,
        fileKey,
        components: ragComponents.map((c) => ({
          key: c.key,
          name: c.name,
          nodeId: c.nodeId,
          description: c.description,
          componentType: c.componentType,
          ...(c.bounds && { bounds: c.bounds }),
          ...(c.properties && Object.keys(c.properties).length > 0 && { properties: c.properties }),
          ...(c.variants && c.variants.length > 0 && { variants: c.variants, variantCount: c.variantCount ?? c.variants.length }),
          ...(c.textLayers && c.textLayers.length > 0 && { textLayers: c.textLayers }),
        })),
        categories: {
          designSystem: designSystemInput.trim() || undefined,
          aestheticStyle: aestheticStyleInput.trim() || undefined,
          usageHint: usageHintInput.trim() || undefined,
          commonContexts,
        },
      });
      const msg =
        lang === 'de'
          ? `${result.addedCount} neu, ${result.updatedCount} aktualisiert in ${(result.durationMs / 1000).toFixed(1)}s`
          : `${result.addedCount} added, ${result.updatedCount} updated in ${(result.durationMs / 1000).toFixed(1)}s`;
      setAddResult(msg);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAddingToRag(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
          {lang === 'de' ? 'Beschreibung / Prompt' : 'Description / Prompt'}
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t('composePromptPlaceholder', lang)}
          style={{
            width: '100%',
            minHeight: '80px',
            padding: '10px',
            fontSize: '13px',
            border: '1px solid var(--msqdx-border-color)',
            borderRadius: '8px',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
        <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
          {t('projectIdPlaceholder', lang)}
        </label>
        <input
          type="text"
          value={projectIdInput}
          onChange={(e) => setProjectIdInput(e.target.value)}
          placeholder="e.g. my-project"
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: '13px',
            border: '1px solid var(--msqdx-border-color)',
            borderRadius: '8px',
            fontFamily: 'inherit',
          }}
        />
        <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--msqdx-text-secondary)', marginTop: '8px' }}>
          {t('viewport', lang)}
        </label>
        <select
          value={viewport}
          onChange={(e) => setViewport(e.target.value as ViewportType)}
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: '13px',
            border: '1px solid var(--msqdx-border-color)',
            borderRadius: '8px',
            fontFamily: 'inherit',
          }}
        >
          <option value="desktop">{t('desktop', lang)}</option>
          <option value="tablet">{lang === 'de' ? 'Tablet (768px)' : 'Tablet (768px)'}</option>
          <option value="mobile">{t('mobile', lang)}</option>
        </select>
        <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--msqdx-text-secondary)', marginTop: '8px' }}>
          {lang === 'de' ? 'Präferenzen (optional)' : 'Preferences (optional)'}
        </label>
        <input
          type="text"
          value={preferences}
          onChange={(e) => setPreferences(e.target.value)}
          placeholder={lang === 'de' ? 'z.B. mehr Whitespace, kompakter' : 'e.g. more whitespace, more compact'}
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: '13px',
            border: '1px solid var(--msqdx-border-color)',
            borderRadius: '8px',
            fontFamily: 'inherit',
          }}
        />
      </div>

      <div
        style={{
          padding: '12px',
          background: 'rgba(15,23,42,0.03)',
          borderRadius: '8px',
          border: '1px solid var(--msqdx-border-color)',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--msqdx-text-secondary)', marginBottom: '8px' }}>
          {t('crawlLibrary', lang)}
        </div>
        <p style={{ fontSize: '11px', color: 'var(--msqdx-text-secondary)', margin: '0 0 8px 0' }}>
          {t('crawlLibraryDesc', lang)}
        </p>
        <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--msqdx-text-secondary)', marginBottom: '4px', display: 'block' }}>
          {t('crawlFileKeyLabel', lang)}
        </label>
        <input
          type="text"
          value={fileKeyInput}
          onChange={(e) => setFileKeyInput(e.target.value)}
          placeholder={t('crawlFileKeyPlaceholder', lang)}
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: '13px',
            border: '1px solid var(--msqdx-border-color)',
            borderRadius: '8px',
            fontFamily: 'inherit',
            marginBottom: '8px',
          }}
        />
        <button
          type="button"
          className="msqdx-button secondary"
          disabled={isCrawling || !projectIdInput.trim()}
          onClick={handleCrawl}
        >
          {isCrawling ? t('crawling', lang) : t('crawlRag', lang)}
        </button>
        {crawlResult && (
          <div style={{ fontSize: '12px', color: 'var(--msqdx-green)', marginTop: '8px' }}>{crawlResult}</div>
        )}
        {crawlError && (
          <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px' }}>{crawlError}</div>
        )}
      </div>

      <div
        style={{
          padding: '12px',
          background: 'rgba(15,23,42,0.03)',
          borderRadius: '8px',
          border: '1px solid var(--msqdx-border-color)',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--msqdx-text-secondary)', marginBottom: '8px' }}>
          {t('addComponentsSection', lang)}
        </div>
        <p style={{ fontSize: '11px', color: 'var(--msqdx-text-secondary)', margin: '0 0 8px 0' }}>
          {t('addComponentsDesc', lang)}
        </p>
        <button
          type="button"
          className="msqdx-button secondary"
          onClick={handleLoadRAGComponents}
          style={{ marginBottom: '8px' }}
        >
          {t('loadSelection', lang)}
        </button>
        {ragComponents && ragComponents.length > 0 && (
          <>
            <div style={{ fontSize: '11px', color: 'var(--msqdx-text-secondary)', marginBottom: '4px' }}>
              {ragComponents.length} {lang === 'de' ? 'Komponenten geladen' : 'components loaded'}:
            </div>
            <ul style={{ fontSize: '11px', margin: '0 0 8px 0', paddingLeft: '16px', maxHeight: '60px', overflowY: 'auto' }}>
              {ragComponents.slice(0, 8).map((c) => (
                <li key={c.key}>{c.name}</li>
              ))}
              {ragComponents.length > 8 && (
                <li>… +{ragComponents.length - 8} {lang === 'de' ? 'weitere' : 'more'}</li>
              )}
            </ul>
            <details style={{ marginBottom: '10px' }}>
              <summary style={{ fontSize: '11px', fontWeight: '600', color: 'var(--msqdx-text-secondary)', cursor: 'pointer' }}>
                {lang === 'de' ? 'Erkennung prüfen (Debug)' : 'Check extraction (debug)'}
              </summary>
              <div style={{ fontSize: '10px', marginTop: '6px', padding: '8px', background: 'rgba(0,0,0,0.04)', borderRadius: '6px', maxHeight: '200px', overflowY: 'auto', fontFamily: 'monospace' }}>
                {ragComponents.map((c) => (
                  <div key={c.key} style={{ marginBottom: '10px', borderBottom: '1px solid var(--msqdx-border-color)', paddingBottom: '8px' }}>
                    <div style={{ fontWeight: 600 }}>{c.name} ({c.componentType})</div>
                    {c.componentType === 'component_set' && (c.variantCount ?? 0) > 0 && (
                      <>
                        <div style={{ marginTop: '4px' }}>Varianten: {c.variantCount}</div>
                        {c.properties && Object.keys(c.properties).length > 0 && (
                          <div style={{ marginTop: '2px' }}>
                            Properties: {Object.entries(c.properties).map(([k, p]) => `${k}=[${(p.options ?? []).join(', ')}]`).join(', ')}
                          </div>
                        )}
                        {c.variants && c.variants.length > 0 && (
                          <div style={{ marginTop: '2px', color: 'var(--msqdx-text-secondary)' }}>
                            Beispiele: {c.variants.slice(0, 5).map((v) => v.name).join(', ')}{c.variants.length > 5 ? ` … +${c.variants.length - 5}` : ''}
                          </div>
                        )}
                        {c.textLayers && c.textLayers.length > 0 && (
                          <div style={{ marginTop: '2px' }}>Text-Layer: {c.textLayers.map((t) => t.name).join(', ')}</div>
                        )}
                      </>
                    )}
                    {c.componentType === 'component' && (
                      <div style={{ marginTop: '2px', color: 'var(--msqdx-text-secondary)' }}>Einzelkomponente (keine Varianten)</div>
                    )}
                  </div>
                ))}
              </div>
            </details>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--msqdx-text-secondary)', marginBottom: '4px', display: 'block' }}>
              {t('designSystemLabel', lang)}
            </label>
            <input
              type="text"
              value={designSystemInput}
              onChange={(e) => setDesignSystemInput(e.target.value)}
              placeholder={t('designSystemPlaceholder', lang)}
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: '12px',
                border: '1px solid var(--msqdx-border-color)',
                borderRadius: '6px',
                fontFamily: 'inherit',
                marginBottom: '6px',
              }}
            />
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--msqdx-text-secondary)', marginBottom: '4px', display: 'block' }}>
              {t('aestheticStyleLabel', lang)}
            </label>
            <input
              type="text"
              value={aestheticStyleInput}
              onChange={(e) => setAestheticStyleInput(e.target.value)}
              placeholder={t('aestheticStylePlaceholder', lang)}
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: '12px',
                border: '1px solid var(--msqdx-border-color)',
                borderRadius: '6px',
                fontFamily: 'inherit',
                marginBottom: '6px',
              }}
            />
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--msqdx-text-secondary)', marginBottom: '4px', display: 'block' }}>
              {t('tagsLabel', lang)}
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder={t('tagsPlaceholder', lang)}
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: '12px',
                border: '1px solid var(--msqdx-border-color)',
                borderRadius: '6px',
                fontFamily: 'inherit',
                marginBottom: '6px',
              }}
            />
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--msqdx-text-secondary)', marginBottom: '4px', display: 'block' }}>
              {t('usageHintLabel', lang)}
            </label>
            <input
              type="text"
              value={usageHintInput}
              onChange={(e) => setUsageHintInput(e.target.value)}
              placeholder={t('usageHintPlaceholder', lang)}
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: '12px',
                border: '1px solid var(--msqdx-border-color)',
                borderRadius: '6px',
                fontFamily: 'inherit',
                marginBottom: '8px',
              }}
            />
            <button
              type="button"
              className="msqdx-button secondary"
              disabled={isAddingToRag}
              onClick={handleAddToRAG}
            >
              {isAddingToRag ? t('addingToRag', lang) : t('addToRag', lang)}
            </button>
          </>
        )}
        {addResult && (
          <div style={{ fontSize: '12px', color: 'var(--msqdx-green)', marginTop: '8px' }}>{addResult}</div>
        )}
        {addError && (
          <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px' }}>{addError}</div>
        )}
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--msqdx-border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--msqdx-text-secondary)', marginBottom: '6px' }}>
            {lang === 'de' ? 'Admin' : 'Admin'}
          </div>
          <button
            type="button"
            className="msqdx-button secondary"
            disabled={isResettingDb}
            onClick={async () => {
              const msg = lang === 'de'
                ? 'Datenbank wirklich leeren? Alle Projekte, Komponenten und Crawl-Logs werden gelöscht.'
                : 'Really clear the database? All projects, components and crawl logs will be deleted.';
              if (!window.confirm(msg)) return;
              setIsResettingDb(true);
              setResetDbResult(null);
              setResetDbError(null);
              try {
                await resetCreationDb(ragApiUrl);
                setResetDbResult(lang === 'de' ? 'Datenbank geleert.' : 'Database cleared.');
              } catch (err) {
                setResetDbError(err instanceof Error ? err.message : String(err));
              } finally {
                setIsResettingDb(false);
              }
            }}
            style={{ fontSize: '12px' }}
          >
            {isResettingDb ? (lang === 'de' ? 'Leere…' : 'Clearing…') : (lang === 'de' ? 'DB leeren' : 'Clear DB')}
          </button>
          {resetDbResult && <div style={{ fontSize: '12px', color: 'var(--msqdx-green)', marginTop: '6px' }}>{resetDbResult}</div>}
          {resetDbError && <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '6px' }}>{resetDbError}</div>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="msqdx-button"
          disabled={!prompt.trim() || !projectIdInput.trim() || isComposing || isRendering}
          onClick={handleCompose}
        >
          {isComposing ? t('composing', lang) : t('compose', lang)}
        </button>
        {lastResult && (
          <button
            type="button"
            className="msqdx-button secondary"
            disabled={isRendering}
            onClick={handleRenderLast}
          >
            {lang === 'de' ? 'Erneut rendern' : 'Render again'}
          </button>
        )}
        {renderSuccess && onRefineLayout && (
          <button
            type="button"
            className="msqdx-button secondary"
            disabled={!hasApiKey || isRefining}
            onClick={onRefineLayout}
            title={!hasApiKey ? t('needApiKey', lang) : ''}
          >
            {isRefining ? t('refiningLayout', lang) : t('refineLayout', lang)}
          </button>
        )}
        {renderSuccess && onCheckLayout && (
          <button
            type="button"
            className="msqdx-button secondary"
            disabled={layoutCheckInProgress}
            onClick={onCheckLayout}
          >
            {layoutCheckInProgress ? (lang === 'de' ? 'Prüfe…' : 'Checking…') : (lang === 'de' ? 'Layout prüfen' : 'Check layout')}
          </button>
        )}
      </div>

      {composeError && (
        <div style={{ fontSize: '12px', color: '#ef4444' }}>{composeError}</div>
      )}
      {lastResult?.warnings?.map((w, i) => (
        <div key={i} style={{ fontSize: '12px', color: 'var(--msqdx-orange)' }}>
          {w}
        </div>
      ))}
      {renderError && (
        <div style={{ fontSize: '12px', color: '#ef4444' }}>{renderError}</div>
      )}
      {renderSuccess && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '12px', color: 'var(--msqdx-green)' }}>
            {t('composeSuccess', lang)}
          </div>
          {lastResult?.compositionId && !ratingSent && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--msqdx-text-secondary)' }}>
                {lang === 'de' ? 'Bewertung:' : 'Rate:'}
              </span>
              <button
                type="button"
                aria-label={lang === 'de' ? 'Gut' : 'Good'}
                onClick={async () => {
                  try {
                    await rateComposition(ragApiUrl, lastResult!.compositionId!, 'up');
                    setRatingSent('up');
                  } catch {
                    /* ignore */
                  }
                }}
                style={{
                  padding: '4px 8px',
                  border: '1px solid var(--msqdx-border-color)',
                  borderRadius: '6px',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                👍
              </button>
              <button
                type="button"
                aria-label={lang === 'de' ? 'Schlecht' : 'Bad'}
                onClick={async () => {
                  try {
                    await rateComposition(ragApiUrl, lastResult!.compositionId!, 'down');
                    setRatingSent('down');
                  } catch {
                    /* ignore */
                  }
                }}
                style={{
                  padding: '4px 8px',
                  border: '1px solid var(--msqdx-border-color)',
                  borderRadius: '6px',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                👎
              </button>
            </div>
          )}
          {ratingSent && (
            <span style={{ fontSize: '11px', color: 'var(--msqdx-text-secondary)' }}>
              {lang === 'de' ? 'Danke!' : 'Thanks!'}
            </span>
          )}
        </div>
      )}
      {refineProgress && (
        <div style={{ fontSize: '12px', color: 'var(--msqdx-text-secondary)' }}>{refineProgress}</div>
      )}
      {refineError && (
        <div style={{ fontSize: '12px', color: '#ef4444' }}>{refineError}</div>
      )}
      {layoutFeedback && (
        <div
          style={{
            fontSize: '12px',
            color: 'var(--msqdx-text-secondary)',
            padding: '10px',
            background: 'rgba(15,23,42,0.03)',
            borderRadius: '8px',
            border: '1px solid var(--msqdx-border-color)',
          }}
        >
          {layoutFeedback}
        </div>
      )}
      {layoutCheckError && (
        <div style={{ fontSize: '12px', color: '#ef4444' }}>{layoutCheckError}</div>
      )}

      {lastResult && (
        <details style={{ marginTop: '8px' }}>
          <summary style={{ fontSize: '11px', cursor: 'pointer', color: 'var(--msqdx-text-secondary)' }}>
            {lang === 'de' ? 'Composition JSON anzeigen' : 'Show composition JSON'}
          </summary>
          <pre
            style={{
              marginTop: '8px',
              padding: '10px',
              fontSize: '11px',
              fontFamily: 'var(--msqdx-font-mono), monospace',
              background: 'rgba(15,23,42,0.03)',
              borderRadius: '8px',
              overflow: 'auto',
              maxHeight: '200px',
            }}
          >
            {JSON.stringify(
              { composition: lastResult.composition, resolvedKeys: lastResult.resolvedKeys },
              null,
              2
            )}
          </pre>
        </details>
      )}
    </div>
  );
}
