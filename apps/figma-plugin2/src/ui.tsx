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
import { generateDSLFromPrompt } from './api/dsl-llm';
import { URL_CONFIG, getHtmlFigmaCssRegressionFixtureUrl } from './config/urls';
import { convertToBase64 } from './services/screenshot-service';
import { MsqdxPluginAppShell } from './components/MsqdxPluginAppShell';
import { t, Language } from './translations';
import { JourneysPanel } from './components/JourneysPanel';
import { AgentPanel } from './components/AgentPanel';
import { DSLDesignerPanel } from './components/DSLDesignerPanel';
import { RAGDesignPanel } from './components/RAGDesignPanel';
import { HtmlToFigmaPanel } from './components/HtmlToFigmaPanel';
import { PromptSiteToFigmaPanel } from './components/PromptSiteToFigmaPanel';
import { JourneySectionsPanel } from './components/JourneySectionsPanel';
import {
  parseImportedSectionsPayload,
  type JourneyImportedSectionRow,
} from './services/journey-imported-section';
import type { PromptSiteRenderMeta } from './prompt-site-render-meta';
import type { RAGComponentPayload } from './services/rag-selection-service';
import { validateLayout } from './api/rag-compose-client';
import { buildJourneyChainPromptSitePluginMessage } from './services/journey-chain-prompt-site';

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
  "  background-color: var(--msqdx-primary);" +
  "  color: var(--msqdx-text-primary);" +
  "  overflow: hidden;" +
  "  height: 100%;" +
  "  min-height: 100%;" +
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

import { usePluginStore } from './ui/store';
import { usePluginBridge } from './ui/hooks/usePluginBridge';

function App() {
  const store = usePluginStore();
  usePluginBridge();
  const view = usePluginStore(s => s.view);
  const setView = usePluginStore(s => s.setView);
  const experimentalSubPage = usePluginStore(s => s.experimentalSubPage);
  const setExperimentalSubPage = usePluginStore(s => s.setExperimentalSubPage);
  const selection = usePluginStore(s => s.selection);
  const setSelection = usePluginStore(s => s.setSelection);
  const selectedPersona = usePluginStore(s => s.selectedPersona);
  const setSelectedPersona = usePluginStore(s => s.setSelectedPersona);
  const conversation = usePluginStore(s => s.conversation);
  const setConversation = usePluginStore(s => s.setConversation);
  const screenshot = usePluginStore(s => s.screenshot);
  const setScreenshot = usePluginStore(s => s.setScreenshot);
  const settings = usePluginStore(s => s.settings);
  const setSettings = usePluginStore(s => s.setSettings);
  const isLoggingIn = usePluginStore(s => s.isLoggingIn);
  const setIsLoggingIn = usePluginStore(s => s.setIsLoggingIn);
  const loginError = usePluginStore(s => s.loginError);
  const setLoginError = usePluginStore(s => s.setLoginError);
  const isGeneratingWireframe = usePluginStore(s => s.isGeneratingWireframe);
  const setIsGeneratingWireframe = usePluginStore(s => s.setIsGeneratingWireframe);
  const generationProgress = usePluginStore(s => s.generationProgress);
  const setGenerationProgress = usePluginStore(s => s.setGenerationProgress);
  const isScanningComponents = usePluginStore(s => s.isScanningComponents);
  const setIsScanningComponents = usePluginStore(s => s.setIsScanningComponents);
  const isScanningPage = usePluginStore(s => s.isScanningPage);
  const setIsScanningPage = usePluginStore(s => s.setIsScanningPage);
  const htmlToFigmaLoading = usePluginStore(s => s.htmlToFigmaLoading);
  const setHtmlToFigmaLoading = usePluginStore(s => s.setHtmlToFigmaLoading);
  const htmlToFigmaError = usePluginStore(s => s.htmlToFigmaError);
  const setHtmlToFigmaError = usePluginStore(s => s.setHtmlToFigmaError);
  const htmlToFigmaSuccess = usePluginStore(s => s.htmlToFigmaSuccess);
  const setHtmlToFigmaSuccess = usePluginStore(s => s.setHtmlToFigmaSuccess);
  const ragComponents = usePluginStore(s => s.ragComponents);
  const setRagComponents = usePluginStore(s => s.setRagComponents);
  const triggerChainGenerate = usePluginStore(s => s.triggerChainGenerate);
  const setTriggerChainGenerate = usePluginStore(s => s.setTriggerChainGenerate);
  const selectedModel = usePluginStore(s => s.selectedModel);
  const setSelectedModel = usePluginStore(s => s.setSelectedModel);
  const ragFileKey = usePluginStore(s => s.ragFileKey);
  const setRagFileKey = usePluginStore(s => s.setRagFileKey);
  const promptSiteLoading = usePluginStore(s => s.promptSiteLoading);
  const setPromptSiteLoading = usePluginStore(s => s.setPromptSiteLoading);
  const promptSiteError = usePluginStore(s => s.promptSiteError);
  const setPromptSiteError = usePluginStore(s => s.setPromptSiteError);
  const promptSiteSuccess = usePluginStore(s => s.promptSiteSuccess);
  const setPromptSiteSuccess = usePluginStore(s => s.setPromptSiteSuccess);
  const promptSitePreviewUrl = usePluginStore(s => s.promptSitePreviewUrl);
  const setPromptSitePreviewUrl = usePluginStore(s => s.setPromptSitePreviewUrl);
  const promptSiteRenderMeta = usePluginStore(s => s.promptSiteRenderMeta);
  const setPromptSiteRenderMeta = usePluginStore(s => s.setPromptSiteRenderMeta);
  const journeyBriefLoading = usePluginStore(s => s.journeyBriefLoading);
  const setJourneyBriefLoading = usePluginStore(s => s.setJourneyBriefLoading);
  const journeyBriefViewport = usePluginStore(s => s.journeyBriefViewport);
  const setJourneyBriefViewport = usePluginStore(s => s.setJourneyBriefViewport);
  const journeyPromptPrefill = usePluginStore(s => s.journeyPromptPrefill);
  const setJourneyPromptPrefill = usePluginStore(s => s.setJourneyPromptPrefill);
  const journeySectionConcepts = usePluginStore(s => s.journeySectionConcepts);
  const setJourneySectionConcepts = usePluginStore(s => s.setJourneySectionConcepts);
  const journeyImportedSections = usePluginStore(s => s.journeyImportedSections);
  const setJourneyImportedSections = usePluginStore(s => s.setJourneyImportedSections);
  const setJourneyHandoffPack = usePluginStore(s => s.setJourneyHandoffPack);
  const knowledgeBase = usePluginStore(s => s.knowledgeBase);
  const setKnowledgeBase = usePluginStore(s => s.setKnowledgeBase);
  const sectionConceptModalOpen = usePluginStore(s => s.sectionConceptModalOpen);
  const setSectionConceptModalOpen = usePluginStore(s => s.setSectionConceptModalOpen);
  const sectionConceptModalText = usePluginStore(s => s.sectionConceptModalText);
  const setSectionConceptModalText = usePluginStore(s => s.setSectionConceptModalText);

  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
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
  const [ragInferredMetadata, setRagInferredMetadata] = useState<{
    aestheticStyle?: string;
    commonContexts?: string[];
    usageHint?: string;
  } | null>(null);
  const [layoutFeedback, setLayoutFeedback] = useState<string | null>(null);
  const [layoutCheckInProgress, setLayoutCheckInProgress] = useState(false);
  const [layoutCheckError, setLayoutCheckError] = useState<string | null>(null);
  const [journeyPromptPrefillToken, setJourneyPromptPrefillToken] = useState(0);
  const [journeySectionSelectedId, setJourneySectionSelectedId] = useState<string | null>(null);


  const fileKeyResolveRef = useRef<((key: string | null) => void) | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lang: Language = settings?.language || 'de';

  const goToExperimental = () => {
    setExperimentalSubPage(null);
    setView('experimental');
  };



  useEffect(() => {
    if (settings?.brandColor) {
      document.documentElement.style.setProperty('--msqdx-primary', settings.brandColor);
    }
  }, [settings?.brandColor]);

  useEffect(() => {
    if (!triggerChainGenerate) return;
    const { prompt, viewport } = triggerChainGenerate;
    const st = usePluginStore.getState();
    const concepts = st.journeySectionConcepts;
    const handoffPack = st.journeyHandoffPack;
    setPromptSiteLoading(true);
    setPromptSiteError(null);
    setPromptSiteSuccess(false);
    setPromptSitePreviewUrl(null);
    setPromptSiteRenderMeta(null);
    setJourneyImportedSections([]);
    setJourneySectionSelectedId(null);
    parent.postMessage(
      {
        pluginMessage: buildJourneyChainPromptSitePluginMessage({
          prompt,
          viewport,
          sectionConcepts: concepts,
          handoffPack,
        }),
      },
      '*'
    );
    setTriggerChainGenerate(null);
  }, [triggerChainGenerate, setTriggerChainGenerate]);

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

  async function handleGenerateWireframe(userInput: string, viewport: ViewportType, model: AIModelType) {
    if (!settings?.openAiApiKey) {
      const errorMsg = 'OpenAI API-Key fehlt in den SETUP Einstellungen.';
      console.warn(errorMsg);
      parent.postMessage({ pluginMessage: { type: 'notify', message: errorMsg } }, '*');
      return;
    }
    
    setIsGeneratingWireframe(true);
    setGenerationProgress(lang === 'de' ? "Generiere DSL (LLM)..." : "Generating DSL...");
    
    try {
      const widthPx = viewport === 'mobile' ? 390 : 1440;
      const dslJson = await generateDSLFromPrompt(
        settings.openAiApiKey, 
        userInput, 
        widthPx, 
        knowledgeBase
      );
      
      setGenerationProgress(lang === 'de' ? "Rendere in Figma..." : "Rendering in Figma...");
      
      parent.postMessage({
        pluginMessage: {
          type: 'dsl-render',
          dslJson,
        },
      }, '*');
    } catch (err: any) {
      console.error(err);
      setGenerationProgress(null);
      setIsGeneratingWireframe(false);
    }
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
      <>
        <style>{globalStyles}</style>
        <MsqdxPluginAppShell>
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              width: '100%',
              minHeight: 0,
            }}
          >
            <LoginPanel
              onLoginData={handleLoginData}
              isLoading={isLoggingIn}
              error={loginError}
              lang={lang}
            />
          </div>
        </MsqdxPluginAppShell>
      </>
    );
  }

  const navButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    height: '28px',
    borderColor: active ? 'var(--msqdx-primary)' : 'var(--msqdx-border-color)',
    background: active ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.85)',
    color: active ? 'var(--msqdx-primary)' : 'var(--msqdx-text-primary)',
    backdropFilter: 'blur(8px)',
  });

  return (
    <>
      <style>{globalStyles}</style>
      <MsqdxPluginAppShell
        topBarRight={
          <>
            <button
              type="button"
              onClick={() => setView('chat')}
              className={'msqdx-button secondary' + (view === 'chat' ? ' active' : '')}
              style={navButtonStyle(view === 'chat')}
            >
              <span className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '700' }}>
                {t('chat', lang)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setView('journeys')}
              className={'msqdx-button secondary' + (view === 'journeys' ? ' active' : '')}
              style={navButtonStyle(view === 'journeys')}
            >
              <span className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '700' }}>
                {t('journeys', lang)}
              </span>
            </button>
            <button
              type="button"
              onClick={goToExperimental}
              className={'msqdx-button secondary' + (view === 'experimental' ? ' active' : '')}
              style={navButtonStyle(view === 'experimental')}
            >
              <span className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '700' }}>
                {t('experimental', lang)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setView('settings')}
              className={'msqdx-button secondary' + (view === 'settings' ? ' active' : '')}
              title={t('setup', lang)}
              style={{
                ...navButtonStyle(view === 'settings'),
                padding: '0 8px',
                width: '28px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
            </button>
          </>
        }
      >
        {view === 'chat' && (
          <>
            <SelectionInfo />
            
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
                <ChatPanel />
              </div>
            )}
          </>
        )}

        {view === 'settings' && (
          <div className="msqdx-card" style={{ padding: '16px' }}>
            <div className="msqdx-mono" style={{ fontSize: '11px', fontWeight: '700', marginBottom: '20px', color: 'var(--msqdx-primary)' }}>{t('pluginSetup', lang)}</div>
            {settings && (
              <SettingsPanel
                initialSettings={settings}
                onSettingsChange={handleSettingsChange}
                onLogout={handleLogout}
              />
            )}
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
              onJourneyBriefStart={() => {
                setJourneyBriefLoading(true);
                setJourneyImportedSections([]);
                setJourneySectionSelectedId(null);
                setJourneyHandoffPack(null);
              }}
            />
            <JourneySectionsPanel
              lang={lang}
              sections={journeyImportedSections}
              selectedNodeId={journeySectionSelectedId}
              onSelectSection={(id) => setJourneySectionSelectedId(id)}
              loading={promptSiteLoading}
              error={promptSiteError}
              success={promptSiteSuccess}
              previewUrl={promptSitePreviewUrl}
              renderMeta={promptSiteRenderMeta}
              promptText={journeyPromptPrefill}
              sectionConcepts={journeySectionConcepts}
              viewport={journeyBriefViewport}
              onGenerate={({ prompt: p, viewport: v, sectionConcepts: sc }) => {
                setJourneyImportedSections([]);
                setJourneySectionSelectedId(null);
                setPromptSiteLoading(true);
                setPromptSiteError(null);
                setPromptSiteSuccess(false);
                setPromptSitePreviewUrl(null);
                setPromptSiteRenderMeta(null);
                parent.postMessage(
                  {
                    pluginMessage: buildJourneyChainPromptSitePluginMessage({
                      prompt: p,
                      viewport: v,
                      sectionConcepts: sc,
                      handoffPack: usePluginStore.getState().journeyHandoffPack,
                    }),
                  },
                  '*'
                );
              }}
              onClearFeedback={() => {
                setPromptSiteError(null);
                setPromptSiteSuccess(false);
              }}
              progressMessage={generationProgress}
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
      </MsqdxPluginAppShell>
      {sectionConceptModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(15,23,42,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setSectionConceptModalOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSectionConceptModalOpen(false);
          }}
        >
          <div
            style={{
              maxWidth: 'min(520px, 100%)',
              maxHeight: 'min(70vh, 480px)',
              overflow: 'auto',
              background: 'var(--msqdx-bg-elevated, #fff)',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
              border: '1px solid var(--msqdx-border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className="msqdx-mono"
              style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 10px 0', color: 'var(--msqdx-text-primary)' }}
            >
              {lang === 'de' ? 'Sektions-Konzept (MSQDX)' : 'Section concept (MSQDX)'}
            </p>
            <pre
              style={{
                margin: 0,
                fontSize: '11px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: 'var(--msqdx-text-main)',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {sectionConceptModalText}
            </pre>
            <button
              type="button"
              className="msqdx-button"
              style={{ marginTop: '12px', width: '100%' }}
              onClick={() => setSectionConceptModalOpen(false)}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

const container = document.getElementById('react-page');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

