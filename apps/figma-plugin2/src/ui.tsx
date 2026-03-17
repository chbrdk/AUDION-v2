import React, { useState, useEffect } from 'react';
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
  DesignMode,
} from './types';
import { generateConversationId } from './services/conversation-service';
import { LoginPanel } from './components/LoginPanel';
import { setAuthToken, setApiBaseUrl } from './api/audion-client';
import { URL_CONFIG } from './config/urls';
import { convertToBase64 } from './services/screenshot-service';
import { MsqdxLogo } from './components/MsqdxLogo';
import { t, Language } from './translations';
import { JourneysPanel } from './components/JourneysPanel';
import { AgentPanel } from './components/AgentPanel';

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

type View = 'chat' | 'settings' | 'login' | 'journeys' | 'agent';

function App() {
  const [view, setView] = useState<View>('chat');
  const [selection, setSelection] = useState<SelectionMetadata | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [conversation, setConversation] = useState<ConversationHistory | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [settings, setSettings] = useState<PluginSettings | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [isGeneratingWireframe, setIsGeneratingWireframe] = useState(false);
  const [isGeneratingWireframeImage, setIsGeneratingWireframeImage] = useState(false);
  const [isGeneratingConceptPrompt, setIsGeneratingConceptPrompt] = useState(false);
  const [isGeneratingConceptAssembly, setIsGeneratingConceptAssembly] = useState(false);
  const [conceptPromptResult, setConceptPromptResult] = useState<string | null>(null);
  const [conceptAssemblyResult, setConceptAssemblyResult] = useState<{ implementationPrompt: string; sectionCount?: number } | null>(null);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<{ original: string, cleaned: string } | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [knowledgeBase, setKnowledgeBase] = useState<ComponentKnowledgeBase>({ components: [], pages: [], lastUpdated: 0 });
  const [isScanningComponents, setIsScanningComponents] = useState(false);
  const [isScanningPage, setIsScanningPage] = useState(false);
  const lang: Language = settings?.language || 'de';

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

        case 'wireframe-image-generated':
          setIsGeneratingWireframeImage(false);
          setGenerationProgress(null);
          break;

        case 'wireframe-image-error':
          setIsGeneratingWireframeImage(false);
          setGenerationProgress(null);
          if (msg.error) alert('Wireframe-Bild: ' + msg.error);
          break;

        case 'concept-prompt-generated':
          setIsGeneratingConceptPrompt(false);
          setConceptPromptResult(msg.prompt ?? null);
          break;

        case 'concept-prompt-error':
          setIsGeneratingConceptPrompt(false);
          if (msg.error) alert('Konzeptionsprompt: ' + msg.error);
          break;

        case 'concept-assembly-done':
          setIsGeneratingConceptAssembly(false);
          setGenerationProgress(null);
          setConceptAssemblyResult({
            implementationPrompt: msg.implementationPrompt ?? '',
            sectionCount: msg.sectionCount,
          });
          break;

        case 'concept-assembly-error':
          setIsGeneratingConceptAssembly(false);
          setGenerationProgress(null);
          if (msg.error) alert('Wireframe konzipieren: ' + msg.error);
          break;

        case 'generation-progress':
          setGenerationProgress(msg.message);
          break;

        case 'debug-code':
          console.log("AGENT DEBUG - ORIGINAL CODE:", msg.original);
          console.log("AGENT DEBUG - CLEANED CODE:", msg.cleaned);
          setDebugCode({ original: msg.original, cleaned: msg.cleaned });
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

  const handleGenerateWireframe = async (userInput: string, viewport: ViewportType, model: AIModelType, mode: DesignMode) => {
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
        mode,
      },
    }, '*');
  };

  const handleGenerateWireframeImage = (userInput: string, size: string) => {
    if (!settings?.openAiApiKey) {
      figma.notify('OpenAI API-Key fehlt. Bitte in Einstellungen eintragen.');
      return;
    }
    setIsGeneratingWireframeImage(true);
    parent.postMessage({
      pluginMessage: {
        type: 'generate-wireframe-image',
        prompt: userInput,
        apiKey: settings.openAiApiKey,
        size: size || '1024x1536',
      },
    }, '*');
  };

  const handleGenerateConceptPrompt = (userInput: string, viewport?: string) => {
    if (!settings?.openAiApiKey) {
      figma.notify('OpenAI API-Key fehlt. Bitte in Einstellungen eintragen.');
      return;
    }
    setIsGeneratingConceptPrompt(true);
    setConceptPromptResult(null);
    parent.postMessage({
      pluginMessage: {
        type: 'generate-concept-prompt',
        prompt: userInput,
        apiKey: settings.openAiApiKey,
        viewport: viewport || 'desktop',
      },
    }, '*');
  };

  const handleGenerateWireframeConcept = (userInput: string, viewport?: string, imageSize?: string) => {
    if (!settings?.openAiApiKey) {
      figma.notify('OpenAI API-Key fehlt. Bitte in Einstellungen eintragen.');
      return;
    }
    setIsGeneratingConceptAssembly(true);
    setConceptAssemblyResult(null);
    parent.postMessage({
      pluginMessage: {
        type: 'generate-wireframe-concept',
        prompt: userInput,
        apiKey: settings.openAiApiKey,
        viewport: viewport || 'desktop',
        imageSize: imageSize || '1024x1536',
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
            onClick={() => setView('settings')}
            className={'msqdx-button secondary' + (view === 'settings' ? ' active' : '')}
            style={{ 
              padding: '6px 12px', 
              height: '28px',
              borderColor: view === 'settings' ? 'var(--msqdx-primary)' : 'var(--msqdx-border-color)',
              background: view === 'settings' ? 'rgba(15,23,42,0.03)' : 'transparent',
              color: view === 'settings' ? 'var(--msqdx-primary)' : 'var(--msqdx-text-main)'
            }}
          >
            <span className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '700' }}>{t('setup', lang)}</span>
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
            onClick={() => setView('agent')}
            className={'msqdx-button secondary' + (view === 'agent' ? ' active' : '')}
            style={{ 
              padding: '6px 12px', 
              height: '28px',
              borderColor: view === 'agent' ? 'var(--msqdx-primary)' : 'var(--msqdx-border-color)',
              background: view === 'agent' ? 'rgba(15,23,42,0.03)' : 'transparent',
              color: view === 'agent' ? 'var(--msqdx-primary)' : 'var(--msqdx-text-main)'
            }}
          >
            <span className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '700' }}>{t('agent', lang)}</span>
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
          <JourneysPanel lang={lang} projectId={settings?.projectId} />
        )}

            <AgentPanel 
              lang={lang} 
              hasApiKey={!!settings?.openAiApiKey} 
              onGenerate={handleGenerateWireframe}
              onGenerateWireframeImage={handleGenerateWireframeImage}
              onGenerateConceptPrompt={handleGenerateConceptPrompt}
              onGenerateWireframeConcept={handleGenerateWireframeConcept}
              isGenerating={isGeneratingWireframe}
              isGeneratingWireframeImage={isGeneratingWireframeImage}
              isGeneratingConceptPrompt={isGeneratingConceptPrompt}
              isGeneratingConceptAssembly={isGeneratingConceptAssembly}
              conceptPromptResult={conceptPromptResult}
              conceptAssemblyResult={conceptAssemblyResult}
              progressMessage={generationProgress}
              debugCode={debugCode}
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
              onInsertToolButton={() => {
                parent.postMessage({ pluginMessage: { type: 'insert-tool-button' } }, '*');
              }}
              onInsertToolWireframe={() => {
                parent.postMessage({ pluginMessage: { type: 'insert-tool-wireframe' } }, '*');
              }}
            />
      </div>
    </div>
  );
}

const container = document.getElementById('react-page');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

