import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatPanel } from './components/ChatPanel';
import { PersonaSelector } from './components/PersonaSelector';
import { SelectionInfo } from './components/SelectionInfo';
import { SettingsPanel } from './components/SettingsPanel';
import type {
  Persona,
  SelectionMetadata,
  ConversationHistory,
  ChatMessage,
  PluginSettings,
  ComponentKnowledgeBase,
  ViewportType,
  AIModelType,
} from './types';
import { generateConversationId } from './services/conversation-service';
import { LoginPanel } from './components/LoginPanel';
import { setAuthToken, setApiBaseUrl } from './api/audion-client';
import { URL_CONFIG, getHtmlFigmaCssRegressionFixtureUrl } from './config/urls';
import {
  JOURNEY_PROMPT_SITE_COMPONENT_LIBRARY,
  JOURNEY_PROMPT_SITE_RENDER_MODE,
} from './config/journey-prompt-site';
import { convertToBase64 } from './services/screenshot-service';
import { MsqdxLogo } from './components/MsqdxLogo';
import { t, Language } from './translations';
import { JourneysPanel } from './components/JourneysPanel';
import { AgentPanel } from './components/AgentPanel';
import { DSLDesignerPanel } from './components/DSLDesignerPanel';
import { RAGDesignPanel } from './components/RAGDesignPanel';
import { HtmlToFigmaPanel } from './components/HtmlToFigmaPanel';
import { PromptSiteToFigmaPanel } from './components/PromptSiteToFigmaPanel';
import type { PromptSiteRenderMeta } from './prompt-site-render-meta';
import type { RAGComponentPayload } from './services/rag-selection-service';
import { validateLayout } from './api/rag-compose-client';

const globalStyles = 
  "@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+JP:wght@300;400;500;700&display=swap');" +
  ":root {" +
  "  --msqdx-pink: #f256b6;" +
  "  --msqdx-pink-tint: rgba(242, 86, 182, 0.15);" +
  "  --msqdx-blue: #3b82f6;" +
  "  --msqdx-blue-tint: rgba(59, 130, 246, 0.15);" +
  "  --msqdx-yellow: #fef14d;" +
  "  --msqdx-orange: #ff6a3b;" +
  "  --msqdx-purple: #b638ff;" +
  "  --msqdx-green: #00ca55;" +
  "  --msqdx-bg-main: #f8f6f0;" +
  "  --msqdx-bg-card: #ffffff;" +
  "  --msqdx-border-color: rgba(15, 23, 42, 0.08);" +
  "  --msqdx-radius: 20px;" +
  "  --msqdx-text-primary: #0f172a;" +
  "  --msqdx-text-secondary: rgba(15, 23, 42, 0.6);" +
  "  --msqdx-font-mono: 'IBM Plex Mono', monospace;" +
  "  --msqdx-primary: var(--msqdx-blue);" +
  "}" +
  "body {" +
  "  margin: 0;" +
  "  padding: 0;" +
  "  font-family: 'Noto Sans JP', sans-serif;" +
  "  background-color: var(--msqdx-bg-main);" +
  "  color: var(--msqdx-text-primary);" +
  "  overflow: hidden;" +
  "  height: 100vh;" +
  "  transition: background-color 0.3s ease, color 0.3s ease;" +
  "}" +
  "* {" +
  "  box-sizing: border-box;" +
  "}" +
  ".msqdx-card {" +
  "  background-color: var(--msqdx-bg-card);" +
  "  border: 1px solid var(--msqdx-border-color);" +
  "  border-radius: var(--msqdx-radius);" +
  "  padding: 16px;" +
  "  box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.04);" +
  "}" +
  ".msqdx-mono {" +
  "  font-family: var(--msqdx-font-mono);" +
  "  text-transform: uppercase;" +
  "  letter-spacing: 0.05em;" +
  "}" +
  ".msqdx-button {" +
  "  background: var(--msqdx-primary);" +
  "  color: white;" +
  "  border: none;" +
  "  border-radius: 999px;" +
  "  padding: 10px 20px;" +
  "  font-weight: 600;" +
  "  font-size: 13px;" +
  "  cursor: pointer;" +
  "  transition: all 0.2s ease;" +
  "  display: flex;" +
  "  align-items: center;" +
  "  justify-content: center;" +
  "  gap: 8px;" +
  "}" +
  ".msqdx-button:hover:not(:disabled) {" +
  "  opacity: 0.9;" +
  "  transform: translateY(-1px);" +
  "  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);" +
  "}" +
  ".msqdx-button:disabled {" +
  "  opacity: 0.5;" +
  "  cursor: not-allowed;" +
  "  transform: none;" +
  "}" +
  ".msqdx-button.secondary {" +
  "  background: transparent;" +
  "  color: var(--msqdx-text-primary);" +
  "  border: 1px solid var(--msqdx-border-color);" +
  "}" +
  ".msqdx-button.secondary:hover {" +
  "  background: rgba(15, 23, 42, 0.03);" +
  "  border-color: var(--msqdx-text-primary);" +
  "}" +
  ".scroll-container {" +
  "  overflow-y: auto;" +
  "  scrollbar-width: thin;" +
  "  scrollbar-color: rgba(15, 23, 42, 0.1) transparent;" +
  "}" +
  ".scroll-container::-webkit-scrollbar {" +
  "  width: 6px;" +
  "}" +
  ".scroll-container::-webkit-scrollbar-thumb {" +
  "  background-color: rgba(15, 23, 42, 0.1);" +
  "  border-radius: 10px;" +
  "}" +
  "@keyframes pulse {" +
  "  0% { opacity: 0.6; }" +
  "  50% { opacity: 1; }" +
  "  100% { opacity: 0.6; }" +
  "}" +
  ".loading-pulse {" +
  "  animation: pulse 1.5s infinite ease-in-out;" +
  "}";

type View = 'chat' | 'settings' | 'login' | 'journeys' | 'experimental';
type ExperimentalSubPage = null | 'llmdesigner' | 'dsldesigner' | 'ragdesign' | 'htmltofigma';

function App() {
  const [view, setView] = useState<View>('chat');
  const [experimentalSubPage, setExperimentalSubPage] = useState<ExperimentalSubPage>(null);
  const [selection, setSelection] = useState<SelectionMetadata | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [conversation, setConversation] = useState<ConversationHistory | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [settings, setSettings] = useState<PluginSettings | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [isGeneratingWireframe, setIsGeneratingWireframe] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [knowledgeBase, setKnowledgeBase] = useState<ComponentKnowledgeBase>({ components: [], pages: [], lastUpdated: 0 });
  const [isScanningComponents, setIsScanningComponents] = useState(false);
  const [isScanningPage, setIsScanningPage] = useState(false);
  const [dslJsonText, setDslJsonText] = useState('');
  const [isRenderingDSL, setIsRenderingDSL] = useState(false);
  const [dslRenderError, setDslRenderError] = useState<string | null>(null);
  const [dslRenderSuccess, setDslRenderSuccess] = useState(false);
  const [isRenderingCompose, setIsRenderingCompose] = useState(false);
  const [composeRenderError, setComposeRenderError] = useState<string | null>(null);
  const [composeRenderSuccess, setComposeRenderSuccess] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [refineProgress, setRefineProgress] = useState<string | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [ragComponents, setRagComponents] = useState<RAGComponentPayload[] | null>(null);
  const [ragFileKey, setRagFileKey] = useState<string>('plugin-selection');
  const [ragInferredMetadata, setRagInferredMetadata] = useState<{
    aestheticStyle?: string;
    commonContexts?: string[];
    usageHint?: string;
  } | null>(null);
  const [layoutFeedback, setLayoutFeedback] = useState<string | null>(null);
  const [layoutCheckInProgress, setLayoutCheckInProgress] = useState(false);
  const [layoutCheckError, setLayoutCheckError] = useState<string | null>(null);
  const [htmlToFigmaLoading, setHtmlToFigmaLoading] = useState(false);
  const [htmlToFigmaError, setHtmlToFigmaError] = useState<string | null>(null);
  const [htmlToFigmaSuccess, setHtmlToFigmaSuccess] = useState(false);
  const [promptSiteLoading, setPromptSiteLoading] = useState(false);
  const [promptSiteError, setPromptSiteError] = useState<string | null>(null);
  const [promptSiteSuccess, setPromptSiteSuccess] = useState(false);
  const [promptSitePreviewUrl, setPromptSitePreviewUrl] = useState<string | null>(null);
  const [promptSiteRenderMeta, setPromptSiteRenderMeta] = useState<PromptSiteRenderMeta | null>(null);
  const [journeyBriefLoading, setJourneyBriefLoading] = useState(false);
  const [journeyPromptPrefill, setJourneyPromptPrefill] = useState<string | null>(null);
  const [journeyPromptPrefillToken, setJourneyPromptPrefillToken] = useState(0);
  const fileKeyResolveRef = useRef<((key: string | null) => void) | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lang: Language = settings?.language || 'de';

  const goToExperimental = () => {
    setExperimentalSubPage(null);
    setView('experimental');
  };

  useEffect(() => {
    // Add global styles
    const styleTag = document.createElement('style');
    styleTag.innerHTML = globalStyles;
    document.head.appendChild(styleTag);

    // Listen for messages from plugin code
    const messageHandler = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;

      switch (msg.type) {
        case 'settings-loaded': {
          const loadedSettings = msg.settings as PluginSettings;
          setSettings(loadedSettings);
          if (loadedSettings.audionApiUrl) {
            setApiBaseUrl(loadedSettings.audionApiUrl);
          }
          if (!loadedSettings.authToken) {
            setView('login');
          } else if (view !== 'settings') {
            setAuthToken(loadedSettings.authToken);
            setView('chat');
          }
          if (loadedSettings.brandColor) {
            document.documentElement.style.setProperty('--msqdx-primary', loadedSettings.brandColor);
          }
          break;
        }

        case 'selection-data':
        case 'selection-changed':
          setSelection(msg.selection);
          break;

        case 'selection-cleared':
        case 'no-selection':
          setSelection(null);
          setScreenshot(null);
          break;

        case 'screenshot-captured':
          if (msg.screenshotBytes) {
            const base64 = convertToBase64(msg.screenshotBytes);
            setScreenshot(base64);
          }
          setIsCapturingScreenshot(false);
          break;
        
        case 'screenshot-error':
          console.error('Screenshot capture error:', msg.error);
          setIsCapturingScreenshot(false);
          break;

        case 'conversation-loaded':
          setConversation(msg.conversation);
          break;

        case 'wireframe-generated':
        case 'wireframe-error':
          setIsGeneratingWireframe(false);
          setGenerationProgress(null);
          if (msg.type === 'wireframe-error') {
            console.error('Wireframe generation error:', msg.error);
            alert(t('generationError', lang) + ': ' + msg.error);
          }
          break;

        case 'generation-progress':
          setGenerationProgress(msg.message);
          break;

        case 'dsl-render-success':
          setIsRenderingDSL(false);
          setDslRenderError(null);
          setDslRenderSuccess(true);
          break;

        case 'dsl-render-error':
          setIsRenderingDSL(false);
          setDslRenderError((msg as { error?: string }).error ?? 'Unknown error');
          break;

        case 'rag-compose-render-success':
          setIsRenderingCompose(false);
          setComposeRenderError(null);
          setComposeRenderSuccess(true);
          setLayoutFeedback(null);
          setLayoutCheckError(null);
          break;

        case 'rag-compose-render-error':
          setIsRenderingCompose(false);
          setComposeRenderError((msg as { error?: string }).error ?? 'Unknown error');
          break;

        case 'rag-refine-progress':
          setRefineProgress((msg as { message?: string }).message ?? null);
          break;

        case 'rag-refine-success':
          setIsRefining(false);
          setRefineProgress(null);
          setRefineError(null);
          break;

        case 'rag-refine-error':
          setIsRefining(false);
          setRefineProgress(null);
          setRefineError((msg as { error?: string }).error ?? 'Unknown error');
          break;

        case 'html-to-figma-success':
          setHtmlToFigmaLoading(false);
          setHtmlToFigmaError(null);
          setHtmlToFigmaSuccess(true);
          break;

        case 'html-to-figma-error':
          setHtmlToFigmaLoading(false);
          setHtmlToFigmaError((msg as { error?: string }).error ?? 'Unknown error');
          setHtmlToFigmaSuccess(false);
          break;

        case 'prompt-site-to-figma-success':
          setPromptSiteLoading(false);
          setPromptSiteError(null);
          setPromptSiteSuccess(true);
          setPromptSitePreviewUrl(
            typeof (msg as { previewUrl?: string }).previewUrl === 'string'
              ? (msg as { previewUrl: string }).previewUrl
              : null
          );
          setPromptSiteRenderMeta(
            ((msg as { renderMeta?: unknown }).renderMeta as PromptSiteRenderMeta | undefined) ?? null
          );
          break;

        case 'prompt-site-to-figma-error':
          setPromptSiteLoading(false);
          setPromptSiteError((msg as { error?: string }).error ?? 'Unknown error');
          setPromptSiteSuccess(false);
          setPromptSitePreviewUrl(null);
          setPromptSiteRenderMeta(null);
          break;

        case 'journey-screen-brief-success': {
          setJourneyBriefLoading(false);
          const jp =
            typeof (msg as { pageSpecUserPrompt?: string }).pageSpecUserPrompt === 'string'
              ? (msg as { pageSpecUserPrompt: string }).pageSpecUserPrompt.trim()
              : '';
          if (jp) {
            setJourneyPromptPrefill(jp);
            setJourneyPromptPrefillToken((t) => t + 1);
          }
          const jm = msg as { chainGenerate?: boolean; viewport?: string };
          if (jm.chainGenerate && jp) {
            setPromptSiteLoading(true);
            setPromptSiteError(null);
            setPromptSiteSuccess(false);
            setPromptSitePreviewUrl(null);
            setPromptSiteRenderMeta(null);
            const viewport =
              jm.viewport === 'tablet' || jm.viewport === 'mobile' ? jm.viewport : 'desktop';
            parent.postMessage(
              {
                pluginMessage: {
                  type: 'prompt-site-to-figma',
                  prompt: jp,
                  viewport,
                  componentLibrary: 'default',
                  renderMode: 'free',
                },
              },
              '*'
            );
          }
          break;
        }

        case 'journey-screen-brief-error':
          setJourneyBriefLoading(false);
          console.error(
            'journey-screen-brief-error',
            (msg as { error?: string }).error ?? 'unknown'
          );
          break;

        case 'rag-refine-debug': {
          const d = msg as { tool?: string; args?: unknown; result?: unknown };
          if (d.tool != null) {
            console.log('[RAG Refine]', d.tool, d.args, d.result);
          }
          break;
        }

        case 'rag-screenshot-exported': {
          const base64 = (msg as { base64?: string }).base64;
          if (base64) {
            setLayoutCheckInProgress(true);
            setLayoutCheckError(null);
            const ragUrl = settingsRef.current?.ragApiUrl || URL_CONFIG.RAG_API_BASE;
            validateLayout(ragUrl, base64)
              .then((r) => {
                setLayoutFeedback(r.feedback);
                setLayoutCheckInProgress(false);
              })
              .catch((err) => {
                setLayoutCheckError(err instanceof Error ? err.message : 'Validation failed');
                setLayoutFeedback(null);
                setLayoutCheckInProgress(false);
              });
          }
          break;
        }

        case 'rag-screenshot-error': {
          setLayoutCheckInProgress(false);
          setLayoutCheckError((msg as { error?: string }).error ?? 'Export failed');
          setLayoutFeedback(null);
          break;
        }

        case 'file-key': {
          const resolver = fileKeyResolveRef.current;
          if (resolver) {
            fileKeyResolveRef.current = null;
            resolver((msg as { fileKey?: string | null }).fileKey ?? null);
          }
          break;
        }

        case 'rag-components-loaded': {
          const m = msg as {
            components: RAGComponentPayload[];
            fileKey?: string;
            inferred?: { aestheticStyle?: string; commonContexts?: string[]; usageHint?: string };
          };
          setRagComponents(m.components);
          setRagFileKey(m.fileKey ?? 'plugin-selection');
          setRagInferredMetadata(m.inferred ?? null);
          break;
        }

        case 'selection-dsl':
          setDslJsonText(JSON.stringify((msg as { dsl: unknown }).dsl, null, 2));
          break;

        case 'selection-empty-dsl':
          setDslRenderError('No selection. Select a frame or group first.');
          break;

        case 'knowledge-loaded': {
          const kb = msg.knowledge as ComponentKnowledgeBase;
          setKnowledgeBase({ ...kb, pages: kb.pages ?? [] });
          setIsScanningComponents(false);
          setIsScanningPage(false);
          break;
        }

        case 'error':
          console.error('Plugin error:', msg.error);
          break;
      }
    };

    window.addEventListener('message', messageHandler);

    // Request initial selection, settings, and knowledge
    parent.postMessage({ pluginMessage: { type: 'get-selection' } }, '*');
    parent.postMessage({ pluginMessage: { type: 'get-settings' } }, '*');
    parent.postMessage({ pluginMessage: { type: 'get-knowledge' } }, '*');

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  useEffect(() => {
    if (settings?.brandColor) {
      document.documentElement.style.setProperty('--msqdx-primary', settings.brandColor);
    }
  }, [settings?.brandColor]);

  useEffect(() => {
    // Load conversation when selection and persona are present
    if (selection && selectedPersona) {
      parent.postMessage(
        {
          pluginMessage: {
            type: 'get-conversation',
            selectionId: selection.nodeId,
            personaId: selectedPersona.id,
          },
        },
        '*'
      );
    }
  }, [selection, selectedPersona]);

  useEffect(() => {
    // Capture screenshot as soon as something is selected
    if (selection) {
      parent.postMessage(
        {
          pluginMessage: {
            type: 'capture-screenshot',
            nodeId: selection.nodeId,
          },
        },
        '*'
      );
    } else {
      setScreenshot(null);
    }
  }, [selection]);

  const handleCaptureScreenshot = () => {
    if (selection) {
      setIsCapturingScreenshot(true);
      parent.postMessage(
        {
          pluginMessage: {
            type: 'capture-screenshot',
            nodeId: selection.nodeId,
          },
        },
        '*'
      );
    }
  };

  const handleMessageSent = () => {
    // Reload conversation to get updated messages
    if (selection && selectedPersona) {
      parent.postMessage(
        {
          pluginMessage: {
            type: 'get-conversation',
            selectionId: selection.nodeId,
            personaId: selectedPersona.id,
          },
        },
        '*'
      );
    }
  };

  const handlePersonaSelect = (persona: Persona | null) => {
    setSelectedPersona(persona);
  };

  const handleSettingsChange = (newSettings: PluginSettings) => {
    setSettings(newSettings);
    // Reload is removed as it causes the white screen in Figma
  };

  const handleLoginData = async (email: string, password: string) => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const baseUrl = settings?.audionApiUrl || URL_CONFIG.AUDION_API_BASE;
      const authUrl = baseUrl + '/api/auth/login';

      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Invalid email or password');
      }

      const data = await response.json();
      const token = data.access_token;

      const newSettings = { ...settings, authToken: token, audionApiUrl: settings?.audionApiUrl || URL_CONFIG.AUDION_API_BASE };
      setSettings(newSettings);
      setAuthToken(token);
      setApiBaseUrl(newSettings.audionApiUrl);
      
      parent.postMessage({
        pluginMessage: {
          type: 'save-settings',
          settings: newSettings
        }
      }, '*');

      setView('chat');
    } catch (err: any) {
      setLoginError(err.message || 'An error occurred during login');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    parent.postMessage({ pluginMessage: { type: 'logout' } }, '*');
    setView('login');
  };

  const handleGenerateWireframe = async (userInput: string, viewport: ViewportType, model: AIModelType) => {
    if (!settings?.openAiApiKey) {
      figma.notify('OpenAI API-Key fehlt. Bitte in Einstellungen eintragen.');
      return;
    }
    setIsGeneratingWireframe(true);
    setGenerationProgress("Initialisiere...");
    parent.postMessage({
      pluginMessage: {
        type: 'generate-wireframe',
        prompt: userInput,
        viewport,
        model,
        apiKey: settings.openAiApiKey,
      },
    }, '*');
  };

  const handleExportKnowledge = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(knowledgeBase, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `audion-knowledge-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      figma.notify(t('knowledgeExported', lang));
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const handleImportKnowledge = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event: any) => {
        try {
          const imported = JSON.parse(event.target.result);
          // Basic validation; ensure pages array for extended knowledge shape
          if (imported && Array.isArray(imported.components)) {
            const normalized = { ...imported, pages: imported.pages ?? [] };
            setKnowledgeBase(normalized);
            parent.postMessage({
              pluginMessage: {
                type: 'save-knowledge',
                knowledge: normalized
              }
            }, '*');
            figma.notify(t('knowledgeImported', lang));
          } else {
            throw new Error('Invalid format');
          }
        } catch (err) {
          alert(t('importError', lang));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  if (view === 'login') {
    return (
      <div 
        style={{ 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: 'var(--msqdx-bg-main)',
          padding: '24px'
        }}
      >
        <style>{globalStyles}</style>
        <LoginPanel 
          onLoginData={handleLoginData} 
          isLoading={isLoggingIn} 
          error={loginError} 
          lang={lang}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: 'var(--msqdx-bg-main)',
        overflow: 'hidden'
      }}
    >
      <style>{globalStyles}</style>
      
      {/* MSQ DX Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '16px 20px',
        backgroundColor: 'var(--msqdx-bg-card)',
        borderBottom: '1px solid var(--msqdx-border-color)',
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MsqdxLogo height={18} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setView('chat')}
            className={'msqdx-button secondary' + (view === 'chat' ? ' active' : '')}
            style={{ 
              padding: '6px 12px', 
              height: '28px',
              borderColor: view === 'chat' ? 'var(--msqdx-primary)' : 'var(--msqdx-border-color)',
              background: view === 'chat' ? 'rgba(15,23,42,0.03)' : 'transparent',
              color: view === 'chat' ? 'var(--msqdx-primary)' : 'var(--msqdx-text-main)'
            }}
          >
            <span className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '700' }}>{t('chat', lang)}</span>
          </button>
          <button 
            onClick={() => setView('journeys')}
            className={'msqdx-button secondary' + (view === 'journeys' ? ' active' : '')}
            style={{ 
              padding: '6px 12px', 
              height: '28px',
              borderColor: view === 'journeys' ? 'var(--msqdx-primary)' : 'var(--msqdx-border-color)',
              background: view === 'journeys' ? 'rgba(15,23,42,0.03)' : 'transparent',
              color: view === 'journeys' ? 'var(--msqdx-primary)' : 'var(--msqdx-text-main)'
            }}
          >
            <span className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '700' }}>{t('journeys', lang)}</span>
          </button>
          <button 
            onClick={goToExperimental}
            className={'msqdx-button secondary' + (view === 'experimental' ? ' active' : '')}
            style={{ 
              padding: '6px 12px', 
              height: '28px',
              borderColor: view === 'experimental' ? 'var(--msqdx-primary)' : 'var(--msqdx-border-color)',
              background: view === 'experimental' ? 'rgba(15,23,42,0.03)' : 'transparent',
              color: view === 'experimental' ? 'var(--msqdx-primary)' : 'var(--msqdx-text-main)'
            }}
          >
            <span className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '700' }}>{t('experimental', lang)}</span>
          </button>
          <button 
            onClick={() => setView('settings')}
            className={'msqdx-button secondary' + (view === 'settings' ? ' active' : '')}
            title={t('setup', lang)}
            style={{ 
              padding: '0 8px', 
              height: '28px',
              width: '28px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: view === 'settings' ? 'var(--msqdx-primary)' : 'var(--msqdx-border-color)',
              background: view === 'settings' ? 'rgba(15,23,42,0.03)' : 'transparent',
              color: view === 'settings' ? 'var(--msqdx-primary)' : 'var(--msqdx-text-main)'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
          </button>
          <button 
            onClick={handleLogout}
            className="msqdx-button secondary"
            style={{ 
              padding: '0 10px', 
              height: '28px',
              color: '#ff6a3b',
              borderColor: '#ff6a3b',
              background: 'transparent'
            }}
          >
            <span className="msqdx-mono" style={{ fontSize: '14px' }}>×</span>
          </button>
        </div>
      </div>

      <div 
        className="scroll-container"
        style={{ 
          flex: 1,
          /* Critical for Figma iframe: allows this flex child to shrink so overflow-y scroll works (avoids clipped / dead-click UI). */
          minHeight: 0,
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px',
          padding: '16px',
        }}
      >
        {view === 'chat' && (
          <>
            <SelectionInfo 
              selection={selection} 
              screenshot={screenshot} 
              isCapturing={isCapturingScreenshot}
              onCaptureScreenshot={handleCaptureScreenshot}
              lang={lang}
            />
            
            <div className="msqdx-card" style={{ padding: '12px' }}>
              <div className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)', marginBottom: '8px' }}>
                {t('selectPersona', lang)}
              </div>
              <PersonaSelector
                selectedPersonaId={selectedPersona?.id || null}
                defaultPersonaId={settings?.defaultPersonaId}
                onPersonaSelect={handlePersonaSelect}
                lang={lang}
              />
            </div>

            {selectedPersona && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
                <ChatPanel
                  persona={selectedPersona}
                  conversationId={conversation?.conversationId || null}
                  selectionMetadata={selection}
                  screenshot={screenshot}
                  onMessageSent={handleMessageSent}
                  lang={lang}
                />
              </div>
            )}
          </>
        )}

        {view === 'settings' && (
          <div className="msqdx-card" style={{ padding: '16px' }}>
            <div className="msqdx-mono" style={{ fontSize: '11px', fontWeight: '700', marginBottom: '20px', color: 'var(--msqdx-primary)' }}>{t('pluginSetup', lang)}</div>
            {settings && <SettingsPanel initialSettings={settings} onSettingsChange={handleSettingsChange} />}
            <button 
              onClick={() => setView('chat')}
              className="msqdx-button"
              style={{ width: '100%', marginTop: '24px', height: '40px' }}
            >
              <span className="msqdx-mono" style={{ fontSize: '11px' }}>{t('backToChat', lang)}</span>
            </button>
          </div>
        )}

        {view === 'journeys' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              width: '100%',
              flexShrink: 0,
            }}
          >
            <JourneysPanel
              lang={lang}
              projectId={settings?.projectId}
              pluginLanguage={settings?.language}
              creationReady={Boolean(
                typeof settings?.creationPluginApiSecret === 'string' &&
                  settings.creationPluginApiSecret.trim().length > 0 &&
                  (settings?.ragApiUrl || URL_CONFIG.RAG_API_BASE)
              )}
              journeyBriefLoading={journeyBriefLoading}
              onJourneyBriefStart={() => setJourneyBriefLoading(true)}
            />
            <PromptSiteToFigmaPanel
              lang={lang}
              loading={promptSiteLoading}
              error={promptSiteError}
              success={promptSiteSuccess}
              previewUrl={promptSitePreviewUrl}
              renderMeta={promptSiteRenderMeta}
              prefillPrompt={journeyPromptPrefill}
              prefillToken={journeyPromptPrefillToken}
              journeyPipeline
              onGenerate={(prompt, viewport, _componentLibrary, _renderMode) => {
                setPromptSiteLoading(true);
                setPromptSiteError(null);
                setPromptSiteSuccess(false);
                setPromptSitePreviewUrl(null);
                setPromptSiteRenderMeta(null);
                parent.postMessage(
                  {
                    pluginMessage: {
                      type: 'prompt-site-to-figma',
                      prompt,
                      viewport,
                      componentLibrary: JOURNEY_PROMPT_SITE_COMPONENT_LIBRARY,
                      renderMode: JOURNEY_PROMPT_SITE_RENDER_MODE,
                    },
                  },
                  '*'
                );
              }}
              onClearFeedback={() => {
                setPromptSiteError(null);
                setPromptSiteSuccess(false);
              }}
            />
          </div>
        )}

        {view === 'experimental' && experimentalSubPage === null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
            <header>
              <h1 className="msqdx-mono" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--msqdx-text-primary)', margin: 0 }}>
                {t('experimental', lang)}
              </h1>
              <p style={{ fontSize: '12px', color: 'var(--msqdx-text-secondary)', margin: '6px 0 0 0' }}>
                {lang === 'de' ? 'Experimentelle Funktionen – wähle eine Option.' : 'Experimental features – choose an option.'}
              </p>
            </header>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setExperimentalSubPage('llmdesigner')}
                className="msqdx-button secondary"
                style={{
                  width: '100%',
                  padding: '16px',
                  height: 'auto',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '4px',
                  textAlign: 'left',
                }}
              >
                <span className="msqdx-mono" style={{ fontSize: '11px', fontWeight: '700' }}>{t('llmdesigner', lang)}</span>
                <span style={{ fontSize: '12px', opacity: 0.9, fontWeight: 400 }}>
                  {lang === 'de' ? 'Wireframes per KI generieren (Prompt, Viewport, Modell, Wissen).' : 'Generate wireframes with AI (prompt, viewport, model, knowledge).'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setExperimentalSubPage('dsldesigner')}
                className="msqdx-button secondary"
                style={{
                  width: '100%',
                  padding: '16px',
                  height: 'auto',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '4px',
                  textAlign: 'left',
                }}
              >
                <span className="msqdx-mono" style={{ fontSize: '11px', fontWeight: '700' }}>{t('dsldesigner', lang)}</span>
                <span style={{ fontSize: '12px', opacity: 0.9, fontWeight: 400 }}>
                  {lang === 'de' ? 'Wireframes aus DSL (Befehle, Struktur) erzeugen.' : 'Generate wireframes from DSL (commands, structure).'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setExperimentalSubPage('ragdesign')}
                className="msqdx-button secondary"
                style={{
                  width: '100%',
                  padding: '16px',
                  height: 'auto',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '4px',
                  textAlign: 'left',
                }}
              >
                <span className="msqdx-mono" style={{ fontSize: '11px', fontWeight: '700' }}>{t('ragdesign', lang)}</span>
                <span style={{ fontSize: '12px', opacity: 0.9, fontWeight: 400 }}>
                  {lang === 'de' ? 'Designs aus Library-Komponenten per RAG + Claude.' : 'Compose designs from library components via RAG + Claude.'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setExperimentalSubPage('htmltofigma')}
                className="msqdx-button secondary"
                style={{
                  width: '100%',
                  padding: '16px',
                  height: 'auto',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '4px',
                  textAlign: 'left',
                }}
              >
                <span className="msqdx-mono" style={{ fontSize: '11px', fontWeight: '700' }}>{t('htmltofigma', lang)}</span>
                <span style={{ fontSize: '12px', opacity: 0.9, fontWeight: 400 }}>
                  {lang === 'de' ? 'Webseite per URL laden und als Figma-Layer einfügen.' : 'Load a webpage by URL and insert as Figma layers.'}
                </span>
              </button>
            </div>
          </div>
        )}

        {view === 'experimental' && experimentalSubPage === 'ragdesign' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>
            <button
              type="button"
              onClick={() => setExperimentalSubPage(null)}
              className="msqdx-button secondary"
              style={{ alignSelf: 'flex-start', padding: '6px 12px', height: '28px', fontSize: '11px' }}
            >
              ← {lang === 'de' ? 'Zurück' : 'Back'}
            </button>
            <header style={{ marginBottom: '4px' }}>
              <h1 className="msqdx-mono" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--msqdx-text-primary)', margin: 0 }}>
                {t('ragdesign', lang)}
              </h1>
              <p style={{ fontSize: '12px', color: 'var(--msqdx-text-secondary)', margin: '4px 0 0 0' }}>
                {lang === 'de' ? 'Designs aus Library-Komponenten per RAG + Claude.' : 'Compose designs from library components via RAG + Claude.'}
              </p>
            </header>
            <RAGDesignPanel
              lang={lang}
              ragApiUrl={settings?.ragApiUrl || URL_CONFIG.RAG_API_BASE}
              projectId={settings?.projectId}
              hasApiKey={!!settings?.openAiApiKey}
              isRefining={isRefining}
              refineProgress={refineProgress}
              refineError={refineError}
              onRefineLayout={() => {
                setIsRefining(true);
                setRefineError(null);
                setRefineProgress(null);
                parent.postMessage({ pluginMessage: { type: 'rag-refine' } }, '*');
              }}
              getFileKey={() =>
                new Promise<string | null>((resolve) => {
                  fileKeyResolveRef.current = resolve;
                  parent.postMessage({ pluginMessage: { type: 'get-file-key' } }, '*');
                  setTimeout(() => {
                    if (fileKeyResolveRef.current) {
                      fileKeyResolveRef.current(null);
                      fileKeyResolveRef.current = null;
                    }
                  }, 3000);
                })
              }
              ragComponents={ragComponents}
              ragFileKey={ragFileKey}
              inferredFromSelection={ragInferredMetadata}
              onLoadRAGComponents={() => {
                setRagComponents(null);
                setRagInferredMetadata(null);
                parent.postMessage({ pluginMessage: { type: 'get-rag-components' } }, '*');
              }}
              onComposeSuccess={() => {
                setComposeRenderSuccess(true);
                setComposeRenderError(null);
              }}
              onComposeError={(err) => {
                setComposeRenderError(err);
              }}
              onRender={(composition, resolvedKeys, resolvedTypes) => {
                setComposeRenderSuccess(false);
                setComposeRenderError(null);
                setIsRenderingCompose(true);
                parent.postMessage(
                  { pluginMessage: { type: 'rag-compose-render', composition, resolvedKeys, resolvedTypes } },
                  '*'
                );
              }}
              isRendering={isRenderingCompose}
              renderError={composeRenderError}
              renderSuccess={composeRenderSuccess}
              onCheckLayout={() => {
                setLayoutFeedback(null);
                setLayoutCheckError(null);
                parent.postMessage({ pluginMessage: { type: 'rag-export-screenshot' } }, '*');
              }}
              layoutFeedback={layoutFeedback}
              layoutCheckInProgress={layoutCheckInProgress}
              layoutCheckError={layoutCheckError}
            />
          </div>
        )}

        {view === 'experimental' && experimentalSubPage === 'htmltofigma' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>
            <button
              type="button"
              onClick={() => setExperimentalSubPage(null)}
              className="msqdx-button secondary"
              style={{ alignSelf: 'flex-start', padding: '6px 12px', height: '28px', fontSize: '11px' }}
            >
              ← {lang === 'de' ? 'Zurück' : 'Back'}
            </button>
            <header style={{ marginBottom: '4px' }}>
              <h1 className="msqdx-mono" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--msqdx-text-primary)', margin: 0 }}>
                {t('htmltofigma', lang)}
              </h1>
              <p style={{ fontSize: '12px', color: 'var(--msqdx-text-secondary)', margin: '4px 0 0 0' }}>
                {lang === 'de' ? 'Webseite per URL laden und als Figma-Layer einfügen.' : 'Load a webpage by URL and insert as Figma layers.'}
              </p>
            </header>
            <HtmlToFigmaPanel
              lang={lang}
              loading={htmlToFigmaLoading}
              error={htmlToFigmaError}
              success={htmlToFigmaSuccess}
              regressionFixtureUrl={getHtmlFigmaCssRegressionFixtureUrl(
                settings?.ragApiUrl || URL_CONFIG.RAG_API_BASE
              )}
              onCapture={(url) => {
                setHtmlToFigmaLoading(true);
                setHtmlToFigmaError(null);
                setHtmlToFigmaSuccess(false);
                parent.postMessage({ pluginMessage: { type: 'html-to-figma-capture', url } }, '*');
              }}
              onClearFeedback={() => {
                setHtmlToFigmaError(null);
                setHtmlToFigmaSuccess(false);
              }}
            />
            <PromptSiteToFigmaPanel
              lang={lang}
              loading={promptSiteLoading}
              error={promptSiteError}
              success={promptSiteSuccess}
              previewUrl={promptSitePreviewUrl}
              renderMeta={promptSiteRenderMeta}
              prefillPrompt={journeyPromptPrefill}
              prefillToken={journeyPromptPrefillToken}
              onGenerate={(prompt, viewport, componentLibrary, renderMode) => {
                setPromptSiteLoading(true);
                setPromptSiteError(null);
                setPromptSiteSuccess(false);
                setPromptSitePreviewUrl(null);
                setPromptSiteRenderMeta(null);
                parent.postMessage(
                  { pluginMessage: { type: 'prompt-site-to-figma', prompt, viewport, componentLibrary, renderMode } },
                  '*'
                );
              }}
              onClearFeedback={() => {
                setPromptSiteError(null);
                setPromptSiteSuccess(false);
              }}
            />
          </div>
        )}

        {view === 'experimental' && experimentalSubPage === 'dsldesigner' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>
            <button
              type="button"
              onClick={() => setExperimentalSubPage(null)}
              className="msqdx-button secondary"
              style={{ alignSelf: 'flex-start', padding: '6px 12px', height: '28px', fontSize: '11px' }}
            >
              ← {lang === 'de' ? 'Zurück' : 'Back'}
            </button>
            <header style={{ marginBottom: '4px' }}>
              <h1 className="msqdx-mono" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--msqdx-text-primary)', margin: 0 }}>
                {t('dsldesigner', lang)}
              </h1>
              <p style={{ fontSize: '12px', color: 'var(--msqdx-text-secondary)', margin: '4px 0 0 0' }}>
                {lang === 'de' ? 'Wireframes aus DSL (Befehle, Struktur) erzeugen.' : 'Generate wireframes from DSL (commands, structure).'}
              </p>
            </header>
            <DSLDesignerPanel
              lang={lang}
              hasApiKey={!!settings?.openAiApiKey}
              apiKey={settings?.openAiApiKey}
              dslJsonValue={dslJsonText}
              onDslJsonChange={setDslJsonText}
              onRender={(json) => {
                setDslRenderSuccess(false);
                setDslRenderError(null);
                setIsRenderingDSL(true);
                parent.postMessage({ pluginMessage: { type: 'dsl-render', dslJson: json } }, '*');
              }}
              onReadSelection={() => {
                setDslRenderError(null);
                parent.postMessage({ pluginMessage: { type: 'read-selection-dsl' } }, '*');
              }}
              isRendering={isRenderingDSL}
              renderError={dslRenderError}
              renderSuccess={dslRenderSuccess}
            />
          </div>
        )}

        {view === 'experimental' && experimentalSubPage === 'llmdesigner' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
            <button
              type="button"
              onClick={() => setExperimentalSubPage(null)}
              className="msqdx-button secondary"
              style={{ alignSelf: 'flex-start', padding: '6px 12px', height: '28px', fontSize: '11px' }}
            >
              ← {lang === 'de' ? 'Zurück' : 'Back'}
            </button>
            <header style={{ marginBottom: '4px' }}>
              <h1 className="msqdx-mono" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--msqdx-text-primary)', margin: 0 }}>
                {t('llmdesigner', lang)}
              </h1>
              <p style={{ fontSize: '12px', color: 'var(--msqdx-text-secondary)', margin: '4px 0 0 0' }}>
                {lang === 'de' ? 'Wireframes per KI generieren (Prompt, Viewport, Modell, Wissen).' : 'Generate wireframes with AI (prompt, viewport, model, knowledge).'}
              </p>
            </header>
            <AgentPanel 
              lang={lang} 
              hasApiKey={!!settings?.openAiApiKey} 
              onGenerate={handleGenerateWireframe}
              isGenerating={isGeneratingWireframe}
              progressMessage={generationProgress}
              knowledgeBase={knowledgeBase}
              onScanComponents={() => {
                setIsScanningComponents(true);
                parent.postMessage({ pluginMessage: { type: 'scan-components' } }, '*');
              }}
              onScanPage={() => {
                setIsScanningPage(true);
                parent.postMessage({ pluginMessage: { type: 'scan-page' } }, '*');
              }}
              isScanningComponents={isScanningComponents}
              isScanningPage={isScanningPage}
              onUpdateKnowledge={(kb) => {
                setKnowledgeBase(kb);
                parent.postMessage({ pluginMessage: { type: 'save-knowledge', knowledge: kb } }, '*');
              }}
              onExport={handleExportKnowledge}
              onImport={handleImportKnowledge}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const container = document.getElementById('react-page');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

