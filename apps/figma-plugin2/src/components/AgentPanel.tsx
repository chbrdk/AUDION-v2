import React, { useState } from 'react';
import { t, Language } from '../translations';
import { ComponentKnowledgeBase, ViewportType, AIModelType, DesignMode } from '../types';

interface AgentPanelProps {
  lang: Language;
  hasApiKey: boolean;
  onGenerate: (prompt: string, viewport: ViewportType, model: AIModelType, mode: DesignMode) => void;
  onGenerateWireframeImage?: (prompt: string, size: string) => void;
  onGenerateConceptPrompt?: (prompt: string, viewport?: string) => void;
  onGenerateWireframeConcept?: (prompt: string, viewport?: string, imageSize?: string) => void;
  isGenerating?: boolean;
  isGeneratingWireframeImage?: boolean;
  isGeneratingConceptPrompt?: boolean;
  isGeneratingConceptAssembly?: boolean;
  conceptPromptResult?: string | null;
  conceptAssemblyResult?: { implementationPrompt: string; sectionCount?: number } | null;
  progressMessage?: string | null;
  debugCode?: { original: string, cleaned: string } | null;
  knowledgeBase: ComponentKnowledgeBase;
  onScanComponents: () => void;
  onScanPage?: () => void;
  onUpdateKnowledge: (kb: ComponentKnowledgeBase) => void;
  onExport: () => void;
  onImport: () => void;
  isScanningComponents?: boolean;
  isScanningPage?: boolean;
  onInsertToolButton?: () => void;
  onInsertToolWireframe?: () => void;
}

export function AgentPanel({ 
  lang, 
  hasApiKey, 
  onGenerate, 
  onGenerateWireframeImage,
  onGenerateConceptPrompt,
  onGenerateWireframeConcept,
  isGenerating = false, 
  isGeneratingWireframeImage = false,
  isGeneratingConceptPrompt = false,
  isGeneratingConceptAssembly = false,
  conceptPromptResult = null,
  conceptAssemblyResult = null,
  progressMessage = null,
  debugCode, 
  knowledgeBase, 
  onScanComponents,
  onScanPage,
  onUpdateKnowledge,
  onExport,
  onImport,
  isScanningComponents = false,
  isScanningPage = false,
  onInsertToolButton,
  onInsertToolWireframe,
}: AgentPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [viewport, setViewport] = useState<ViewportType>('desktop');
  const [model, setModel] = useState<AIModelType>('gpt-5-mini');
  const [designMode, setDesignMode] = useState<DesignMode>('styled');
  const [wireframeImageSize, setWireframeImageSize] = useState<string>('1024x1536');
  const [showDebug, setShowDebug] = useState(false);
  const [showKnowledge, setShowKnowledge] = useState(false);

  const handleGenerate = () => {
    if (!prompt.trim() || !hasApiKey) return;
    onGenerate(prompt, viewport, model, designMode);
  };

  const handleGenerateWireframeImage = () => {
    if (!prompt.trim() || !hasApiKey || !onGenerateWireframeImage) return;
    onGenerateWireframeImage(prompt.trim(), wireframeImageSize);
  };

  const handleGenerateConceptPrompt = () => {
    if (!prompt.trim() || !hasApiKey || !onGenerateConceptPrompt) return;
    onGenerateConceptPrompt(prompt.trim(), viewport);
  };

  const handleGenerateWireframeConcept = () => {
    if (!prompt.trim() || !hasApiKey || !onGenerateWireframeConcept) return;
    onGenerateWireframeConcept(prompt.trim(), viewport, wireframeImageSize);
  };

  const copyConceptPrompt = () => {
    if (!conceptPromptResult) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(conceptPromptResult);
      figma.notify('Konzeptionsprompt in Zwischenablage kopiert');
    }
  };

  const copyAssemblyPrompt = () => {
    if (!conceptAssemblyResult?.implementationPrompt) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(conceptAssemblyResult.implementationPrompt);
      figma.notify('Umsetzungs-Prompt in Zwischenablage kopiert');
    }
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

      {/* Design Mode Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--msqdx-text-secondary)' }}>
          DESIGN MODE
        </label>
        <div style={{ 
          display: 'flex', 
          background: 'rgba(15,23,42,0.03)', 
          borderRadius: '10px', 
          padding: '4px',
          border: '1px solid var(--msqdx-border-color)' 
        }}>
          <button
            onClick={() => setDesignMode('fast')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              fontSize: '11px',
              border: 'none',
              cursor: 'pointer',
              background: designMode === 'fast' ? 'white' : 'transparent',
              boxShadow: designMode === 'fast' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              color: designMode === 'fast' ? 'var(--msqdx-primary)' : 'var(--msqdx-text-secondary)',
              fontWeight: designMode === 'fast' ? '700' : '500',
              transition: 'all 0.2s'
            }}
            title="Ein API-Call erzeugt alle Befehle auf einmal (kann bei komplexen Prompts timeout)"
          >
            Schnell (1 Call)
          </button>
          <button
            onClick={() => setDesignMode('styled')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              fontSize: '11px',
              border: 'none',
              cursor: 'pointer',
              background: designMode === 'styled' ? 'white' : 'transparent',
              boxShadow: designMode === 'styled' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              color: designMode === 'styled' ? 'var(--msqdx-primary)' : 'var(--msqdx-text-secondary)',
              fontWeight: designMode === 'styled' ? '700' : '500',
              transition: 'all 0.2s'
            }}
            title="Director → Designer → Figma: Konzept, dann pro Sektion Design + Figma-Befehle (kleine Calls, robuster)"
          >
            Director → Designer → Figma
          </button>
          <button
            onClick={() => setDesignMode('tools')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              fontSize: '11px',
              border: 'none',
              cursor: 'pointer',
              background: designMode === 'tools' ? 'white' : 'transparent',
              boxShadow: designMode === 'tools' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              color: designMode === 'tools' ? 'var(--msqdx-primary)' : 'var(--msqdx-text-secondary)',
              fontWeight: designMode === 'tools' ? '700' : '500',
              transition: 'all 0.2s'
            }}
            title="OpenAI ruft createSection/addText/createButton auf; Agent-Loop bis fertig"
          >
            Agent (Tools)
          </button>
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

      {onInsertToolButton && (
        <button
          type="button"
          onClick={onInsertToolButton}
          className="msqdx-button secondary"
          style={{
            width: '100%',
            height: '32px',
            borderRadius: '8px',
            fontSize: '11px',
          }}
        >
          <span className="msqdx-mono">Test Button (Atomic Tools)</span>
        </button>
      )}
      {onInsertToolWireframe && (
        <button
          type="button"
          onClick={onInsertToolWireframe}
          className="msqdx-button secondary"
          style={{
            width: '100%',
            height: '32px',
            borderRadius: '8px',
            fontSize: '11px',
          }}
        >
          <span className="msqdx-mono">Wireframe (Tools)</span>
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
          Bildformat (Wireframe als Bild)
        </label>
        <select
          value={wireframeImageSize}
          onChange={(e) => setWireframeImageSize(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            background: 'rgba(15,23,42,0.03)',
            border: '1px solid var(--msqdx-border-color)',
            borderRadius: '8px',
            fontSize: '11px',
            color: 'var(--msqdx-text-main)',
            outline: 'none',
            appearance: 'none',
          }}
        >
          <option value="1024x1536">Hochformat – Landingpage (1024×1536)</option>
          <option value="1536x1024">Querformat (1536×1024)</option>
          <option value="1024x1024">Quadrat (1024×1024)</option>
        </select>
      </div>
      <button
        onClick={handleGenerateWireframeImage}
        disabled={!prompt.trim() || isGeneratingWireframeImage || !onGenerateWireframeImage}
        className="msqdx-button secondary"
        style={{
          width: '100%',
          height: '36px',
          borderRadius: '10px',
          fontSize: '12px',
          opacity: (!prompt.trim() || isGeneratingWireframeImage) ? 0.5 : 1,
          cursor: (!prompt.trim() || isGeneratingWireframeImage) ? 'not-allowed' : 'pointer',
        }}
      >
        <span className="msqdx-mono">
          {isGeneratingWireframeImage ? '…' : '🖼️ Wireframe als Bild (GPT Image 1.5)'}
        </span>
      </button>

      <button
        onClick={handleGenerateConceptPrompt}
        disabled={!prompt.trim() || isGeneratingConceptPrompt || !onGenerateConceptPrompt}
        className="msqdx-button secondary"
        style={{
          width: '100%',
          height: '36px',
          borderRadius: '10px',
          fontSize: '12px',
          opacity: (!prompt.trim() || isGeneratingConceptPrompt) ? 0.5 : 1,
          cursor: (!prompt.trim() || isGeneratingConceptPrompt) ? 'not-allowed' : 'pointer',
        }}
      >
        <span className="msqdx-mono">
          {isGeneratingConceptPrompt ? '…' : '📋 Konzeptionsprompt (Wireframe + Figma Make)'}
        </span>
      </button>

      <button
        onClick={handleGenerateWireframeConcept}
        disabled={!prompt.trim() || isGeneratingConceptAssembly || !onGenerateWireframeConcept}
        className="msqdx-button secondary"
        style={{
          width: '100%',
          height: '36px',
          borderRadius: '10px',
          fontSize: '12px',
          opacity: (!prompt.trim() || isGeneratingConceptAssembly) ? 0.5 : 1,
          cursor: (!prompt.trim() || isGeneratingConceptAssembly) ? 'not-allowed' : 'pointer',
        }}
      >
        <span className="msqdx-mono">
          {isGeneratingConceptAssembly ? '…' : '🖼️ Wireframe konzipieren & als Bilder (pro Sektion)'}
        </span>
      </button>

      {(isGeneratingConceptAssembly && progressMessage) && (
        <div className="loading-pulse" style={{ fontSize: '10px', color: 'var(--msqdx-primary)', textAlign: 'center', paddingBottom: '4px', fontWeight: '600' }}>
          ✨ {progressMessage}
        </div>
      )}

      {conceptAssemblyResult && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginTop: '8px',
          padding: '12px',
          background: 'rgba(15,23,42,0.03)',
          border: '1px solid var(--msqdx-border-color)',
          borderRadius: '10px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '700', color: 'var(--msqdx-text-secondary)' }}>
              Umsetzungs-Prompt (für Figma Make)
              {conceptAssemblyResult.sectionCount != null && (
                <span style={{ marginLeft: '6px', fontWeight: '500' }}> · {conceptAssemblyResult.sectionCount} Sektionen auf Canvas</span>
              )}
            </span>
            <button
              onClick={copyAssemblyPrompt}
              className="msqdx-button secondary"
              style={{ padding: '4px 10px', fontSize: '10px', height: '28px' }}
            >
              Kopieren
            </button>
          </div>
          <textarea
            readOnly
            value={conceptAssemblyResult.implementationPrompt}
            style={{
              width: '100%',
              minHeight: '160px',
              padding: '10px',
              fontSize: '11px',
              fontFamily: 'var(--msqdx-font-mono), monospace',
              background: 'var(--msqdx-bg-card)',
              border: '1px solid var(--msqdx-border-color)',
              borderRadius: '8px',
              resize: 'vertical',
              color: 'var(--msqdx-text-main)',
            }}
          />
        </div>
      )}

      {conceptPromptResult && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginTop: '8px',
          padding: '12px',
          background: 'rgba(15,23,42,0.03)',
          border: '1px solid var(--msqdx-border-color)',
          borderRadius: '10px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '700', color: 'var(--msqdx-text-secondary)' }}>
              Konzeptionsprompt (für Figma Make kopieren)
            </span>
            <button
              onClick={copyConceptPrompt}
              className="msqdx-button secondary"
              style={{ padding: '4px 10px', fontSize: '10px', height: '28px' }}
            >
              Kopieren
            </button>
          </div>
          <textarea
            readOnly
            value={conceptPromptResult}
            style={{
              width: '100%',
              minHeight: '160px',
              padding: '10px',
              fontSize: '11px',
              fontFamily: 'var(--msqdx-font-mono), monospace',
              background: 'var(--msqdx-bg-card)',
              border: '1px solid var(--msqdx-border-color)',
              borderRadius: '8px',
              resize: 'vertical',
              color: 'var(--msqdx-text-main)',
            }}
          />
        </div>
      )}

      {debugCode && (
        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--msqdx-border-color)', paddingTop: '12px' }}>
          <button 
            onClick={() => setShowDebug(!showDebug)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--msqdx-primary)',
              fontSize: '11px',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {showDebug ? '[-] Hide Debug Info' : '[+] Show Debug Info'}
          </button>
          
          {showDebug && (
            <div style={{ marginTop: '8px', maxHeight: '150px', overflowY: 'auto', background: '#f1f5f9', padding: '8px', borderRadius: '8px', fontSize: '10px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Cleaned Code:</div>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, color: '#334155' }}>
                {debugCode.cleaned}
              </pre>
              <div style={{ fontWeight: 'bold', margin: '8px 0 4px' }}>Original Code:</div>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, color: '#64748b' }}>
                {debugCode.original}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
