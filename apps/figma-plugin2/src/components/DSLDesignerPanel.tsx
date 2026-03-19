import React, { useState } from 'react';
import { t, Language } from '../translations';
import { generateDSLFromPrompt } from '../api/dsl-llm';

interface DSLDesignerPanelProps {
  lang: Language;
  hasApiKey: boolean;
  apiKey: string | undefined;
  dslJsonValue: string;
  onDslJsonChange: (value: string) => void;
  onRender: (dslJson: string) => void;
  onReadSelection: () => void;
  isRendering: boolean;
  renderError: string | null;
  renderSuccess: boolean;
}

type TabMode = 'prompt' | 'json';

export function DSLDesignerPanel({
  lang,
  hasApiKey,
  apiKey,
  dslJsonValue,
  onDslJsonChange,
  onRender,
  onReadSelection,
  isRendering,
  renderError,
  renderSuccess,
}: DSLDesignerPanelProps) {
  const [tab, setTab] = useState<TabMode>('json');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);

  const handleGenerateFromPrompt = async () => {
    if (!apiKey?.trim() || !prompt.trim()) return;
    setIsGenerating(true);
    setLlmError(null);
    try {
      const json = await generateDSLFromPrompt(apiKey, prompt.trim());
      onDslJsonChange(json);
      setTab('json');
    } catch (err) {
      setLlmError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRender = () => {
    const trimmed = dslJsonValue.trim();
    if (!trimmed) return;
    onRender(trimmed);
  };

  const needApiKey = lang === 'de' ? 'OpenAI API-Key in SETUP erforderlich.' : 'OpenAI API key required in SETUP.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          className={'msqdx-button secondary' + (tab === 'json' ? ' active' : '')}
          style={{
            padding: '6px 12px',
            fontSize: '11px',
            background: tab === 'json' ? 'rgba(15,23,42,0.05)' : 'transparent',
          }}
          onClick={() => setTab('json')}
        >
          {lang === 'de' ? 'DSL-JSON' : 'DSL JSON'}
        </button>
        <button
          type="button"
          className={'msqdx-button secondary' + (tab === 'prompt' ? ' active' : '')}
          style={{
            padding: '6px 12px',
            fontSize: '11px',
            background: tab === 'prompt' ? 'rgba(15,23,42,0.05)' : 'transparent',
          }}
          onClick={() => setTab('prompt')}
        >
          {lang === 'de' ? 'Aus Prompt (LLM)' : 'From prompt (LLM)'}
        </button>
      </div>

      {tab === 'prompt' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {!hasApiKey && (
            <div style={{ fontSize: '12px', color: 'var(--msqdx-text-secondary)' }}>{needApiKey}</div>
          )}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={lang === 'de' ? 'z.B. Landingpage für eine Pumpenfirma mit Hero, Features, CTA, Footer' : 'e.g. Landing page for a pump company with hero, features, CTA, footer'}
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
          <button
            type="button"
            className="msqdx-button"
            disabled={!hasApiKey || !prompt.trim() || isGenerating}
            onClick={handleGenerateFromPrompt}
            style={{ alignSelf: 'flex-start' }}
          >
            {isGenerating ? (lang === 'de' ? 'Generiere…' : 'Generating…') : (lang === 'de' ? 'DSL generieren' : 'Generate DSL')}
          </button>
          {llmError && (
            <div style={{ fontSize: '12px', color: '#ef4444' }}>{llmError}</div>
          )}
        </div>
      )}

      {tab === 'json' && (
        <>
          <textarea
            value={dslJsonValue}
            onChange={(e) => onDslJsonChange(e.target.value)}
            placeholder='{"page": "My Page", "width": 1440, "children": [...]}'
            style={{
              width: '100%',
              flex: 1,
              minHeight: '200px',
              padding: '10px',
              fontSize: '12px',
              fontFamily: 'var(--msqdx-font-mono), monospace',
              border: '1px solid var(--msqdx-border-color)',
              borderRadius: '8px',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="msqdx-button"
              disabled={!dslJsonValue.trim() || isRendering}
              onClick={handleRender}
            >
              {isRendering ? (lang === 'de' ? 'Rendern…' : 'Rendering…') : (lang === 'de' ? 'In Figma rendern' : 'Render in Figma')}
            </button>
            <button
              type="button"
              className="msqdx-button secondary"
              onClick={onReadSelection}
            >
              {lang === 'de' ? 'Selection als DSL lesen' : 'Read selection as DSL'}
            </button>
          </div>
        </>
      )}

      {renderError && (
        <div style={{ fontSize: '12px', color: '#ef4444' }}>{renderError}</div>
      )}
      {renderSuccess && (
        <div style={{ fontSize: '12px', color: 'var(--msqdx-green)' }}>
          {lang === 'de' ? 'Design in Figma gerendert.' : 'Design rendered in Figma.'}
        </div>
      )}
    </div>
  );
}
