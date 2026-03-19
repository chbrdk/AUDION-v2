import React, { useState } from 'react';
import { t, Language } from '../translations';
import { ComponentKnowledgeBase, ViewportType, AIModelType } from '../types';

interface AgentPanelProps {
  lang: Language;
  hasApiKey: boolean;
  onGenerate: (prompt: string, viewport: ViewportType, model: AIModelType) => void;
  isGenerating?: boolean;
  progressMessage?: string | null;
  knowledgeBase: ComponentKnowledgeBase;
  onScanComponents: () => void;
  onScanPage?: () => void;
  onUpdateKnowledge: (kb: ComponentKnowledgeBase) => void;
  onExport: () => void;
  onImport: () => void;
  isScanningComponents?: boolean;
  isScanningPage?: boolean;
}

export function AgentPanel({ 
  lang, 
  hasApiKey, 
  onGenerate, 
  isGenerating = false, 
  progressMessage = null,
  knowledgeBase, 
  onScanComponents,
  onScanPage,
  onUpdateKnowledge,
  onExport,
  onImport,
  isScanningComponents = false,
  isScanningPage = false,
}: AgentPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [viewport, setViewport] = useState<ViewportType>('desktop');
  const [model, setModel] = useState<AIModelType>('gpt-5-mini');
  const [showKnowledge, setShowKnowledge] = useState(false);

  const handleGenerate = () => {
    if (!prompt.trim() || !hasApiKey) return;
    onGenerate(prompt, viewport, model);
  };

  const removeComponent = (id: string) => {
    const updated = {
      ...knowledgeBase,
      components: knowledgeBase.components.filter(c => c.id !== id),
      pages: knowledgeBase.pages ?? [],
      lastUpdated: Date.now()
    };
    onUpdateKnowledge(updated);
  };

  const removePage = (id: string) => {
    const updated = {
      ...knowledgeBase,
      components: knowledgeBase.components,
      pages: (knowledgeBase.pages ?? []).filter(p => p.id !== id),
      lastUpdated: Date.now()
    };
    onUpdateKnowledge(updated);
  };

  if (!hasApiKey) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        height: '100%',
        padding: '24px',
        textAlign: 'center',
        color: 'var(--msqdx-text-secondary)'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '16px' }}>🤖</div>
        <div style={{ fontSize: '13px', marginBottom: '8px' }}>
          {t('needApiKey', lang)}
        </div>
        <div style={{ fontSize: '11px', opacity: 0.7 }}>
          Gehe zu SETUP und trage deinen OpenAI API Key ein.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', padding: '16px 0' }}>
      
      {/* Knowledge Base Section */}
      <div style={{ 
        background: 'var(--msqdx-bg-card)', 
        border: '1px solid var(--msqdx-border-color)', 
        borderRadius: '12px', 
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>🧠</span>
            <span className="msqdx-mono" style={{ fontSize: '9px', fontWeight: 'bold' }}>
              Knowledge base ({knowledgeBase.components.length} components, {(knowledgeBase.pages ?? []).length} pages)
            </span>
          </div>
          <button 
            onClick={() => setShowKnowledge(!showKnowledge)}
            style={{ background: 'none', border: 'none', color: 'var(--msqdx-primary)', fontSize: '10px', cursor: 'pointer' }}
          >
            {showKnowledge ? t('hide', lang) || 'Verbergen' : t('show', lang) || 'Anzeigen'}
          </button>
        </div>

        {showKnowledge && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto', padding: '4px 0' }}>
            {knowledgeBase.components.length === 0 && (knowledgeBase.pages ?? []).length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--msqdx-text-secondary)', opacity: 0.7 }}>
                Keine Einträge. Füge Komponenten oder eine Seite hinzu.
              </div>
            ) : (
              <>
                {knowledgeBase.components.map(comp => (
                  <div key={comp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15,23,42,0.02)', padding: '6px 8px', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '8px', marginRight: '6px', color: 'var(--msqdx-text-secondary)' }}>Component</span>
                        <span className="msqdx-mono" style={{ fontSize: '11px', fontWeight: '600', flex: 1 }}>{comp.name}</span>
                        <button 
                          onClick={() => removeComponent(comp.id)}
                          style={{ background: 'none', border: 'none', color: '#ff6a3b', cursor: 'pointer', fontSize: '12px', padding: '0 4px' }}
                        >
                          ×
                        </button>
                      </div>
                      {comp.styleCategory && (
                        <div style={{ fontSize: '9px', color: 'var(--msqdx-primary)', marginTop: '2px', fontWeight: '600' }}>
                          ✨ {comp.styleCategory}
                        </div>
                      )}
                      {comp.tags && comp.tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                          {comp.tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} style={{ fontSize: '8px', background: 'rgba(15,23,42,0.05)', padding: '1px 4px', borderRadius: '4px', color: 'var(--msqdx-text-secondary)' }}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {(knowledgeBase.pages ?? []).map(page => (
                  <div key={page.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15,23,42,0.02)', padding: '6px 8px', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '8px', marginRight: '6px', color: 'var(--msqdx-text-secondary)' }}>Page</span>
                        <span className="msqdx-mono" style={{ fontSize: '11px', fontWeight: '600', flex: 1 }}>{page.name}</span>
                        <button 
                          onClick={() => removePage(page.id)}
                          style={{ background: 'none', border: 'none', color: '#ff6a3b', cursor: 'pointer', fontSize: '12px', padding: '0 4px' }}
                        >
                          ×
                        </button>
                      </div>
                      {page.pageType && page.pageType !== 'generic' && (
                        <div style={{ fontSize: '9px', color: 'var(--msqdx-primary)', marginTop: '2px' }}>{page.pageType}</div>
                      )}
                      {page.blueprintSummary && (
                        <div style={{ fontSize: '9px', color: 'var(--msqdx-text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                          {page.blueprintSummary}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: showKnowledge ? '4px' : '0' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={onScanComponents}
              disabled={isScanningComponents || isScanningPage}
              className="msqdx-button secondary"
              style={{ flex: 1, height: '32px', fontSize: '11px', borderRadius: '8px' }}
            >
              <span style={{ fontSize: '12px' }}>🔍</span>
              <span className="msqdx-mono">Add components to knowledge</span>
            </button>
            <button 
              onClick={onScanPage}
              disabled={isScanningComponents || isScanningPage || !onScanPage}
              className="msqdx-button secondary"
              style={{ flex: 1, height: '32px', fontSize: '11px', borderRadius: '8px' }}
            >
              <span style={{ fontSize: '12px' }}>📄</span>
              <span className="msqdx-mono">Add page to knowledge</span>
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={onExport}
            className="msqdx-button secondary"
            title={t('export', lang)}
            style={{ flex: 1, padding: '0', height: '32px', fontSize: '11px', borderRadius: '8px', marginTop: showKnowledge ? '4px' : '0' }}
          >
            <span style={{ fontSize: '12px' }}>📤</span>
          </button>

          <button 
            onClick={onImport}
            className="msqdx-button secondary"
            title={t('import', lang)}
            style={{ flex: 1, padding: '0', height: '32px', fontSize: '11px', borderRadius: '8px' }}
          >
            <span style={{ fontSize: '12px' }}>📥</span>
          </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
          {t('describeUI', lang)}
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Landing Page mit Hero-Section, Feature-Grid und CTA-Footer..."
          style={{
            flex: 1,
            width: '100%',
            padding: '12px',
            background: 'rgba(15,23,42,0.03)',
            border: '1px solid var(--msqdx-border-color)',
            borderRadius: '12px',
            fontSize: '13px',
            color: 'var(--msqdx-text-main)',
            outline: 'none',
            resize: 'none',
            fontFamily: 'inherit'
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
            {t('viewport', lang)}
          </label>
          <select
            value={viewport}
            onChange={(e) => setViewport(e.target.value as ViewportType)}
            style={{
              width: '100%',
              padding: '10px',
              background: 'rgba(15,23,42,0.03)',
              border: '1px solid var(--msqdx-border-color)',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'var(--msqdx-text-main)',
              outline: 'none',
              appearance: 'none'
            }}
          >
            <option value="desktop">{t('desktop', lang)}</option>
            <option value="mobile">{t('mobile', lang)}</option>
            <option value="both">{t('both', lang)}</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
            {t('model', lang)}
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as AIModelType)}
            style={{
              width: '100%',
              padding: '10px',
              background: 'rgba(15,23,42,0.03)',
              border: '1px solid var(--msqdx-border-color)',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'var(--msqdx-text-main)',
              outline: 'none',
              appearance: 'none'
            }}
          >
            <option value="gpt-5-mini">gpt-5-mini (Fast & Smart)</option>
            <option value="gpt-4o-mini">gpt-4o-mini (Fallback)</option>
            <option value="gpt-4o">gpt-4o (Smart)</option>
          </select>
        </div>
      </div>

      {isGenerating && progressMessage && (
        <div className="loading-pulse" style={{ 
          fontSize: '10px', 
          color: 'var(--msqdx-primary)', 
          textAlign: 'center', 
          paddingBottom: '4px',
          fontWeight: '600'
        }}>
          ✨ {progressMessage}
        </div>
      )}
      <button
        onClick={handleGenerate}
        disabled={!prompt.trim() || isGenerating}
        className="msqdx-button"
        style={{
          width: '100%',
          height: '44px',
          borderRadius: '12px',
          opacity: (!prompt.trim() || isGenerating) ? 0.5 : 1,
          cursor: (!prompt.trim() || isGenerating) ? 'not-allowed' : 'pointer',
        }}
      >
        <span className="msqdx-mono">
          {isGenerating ? t('generating', lang) : 'Insert wireframe'}
        </span>
      </button>
    </div>
  );
}
