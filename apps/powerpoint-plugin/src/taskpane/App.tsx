import React, { useState, useEffect, useRef } from 'react';
import { ChatPanel } from '../components/ChatPanel';
import { PersonaSelector } from '../components/PersonaSelector';
import { SelectionInfo } from '../components/SelectionInfo';
import { SettingsPanel } from '../components/SettingsPanel';
import type {
  Persona,
  SelectionMetadata,
  ConversationHistory,
  PluginSettings,
  ComponentKnowledgeBase,
  ViewportType,
  AIModelType,
} from '../types';
import { generateConversationId } from '../services/conversation-service';
import { LoginPanel } from '../components/LoginPanel';
import { setAuthToken, setApiBaseUrl } from '../api/audion-client';
import { URL_CONFIG } from '../config/urls';
import { MsqdxPluginAppShell } from '../components/MsqdxPluginAppShell';
import { t, Language } from '../translations';
import { OfficeService } from '../services/office-service';

/* global Office */

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
  "  height: 100vh;" +
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

type View = 'chat' | 'settings' | 'login';

export function App() {
  const [view, setView] = useState<View>('chat');
  const [selection, setSelection] = useState<SelectionMetadata | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [conversation, setConversation] = useState<ConversationHistory | null>(null);
  const [settings, setSettings] = useState<PluginSettings | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [knowledgeBase, setKnowledgeBase] = useState<ComponentKnowledgeBase>({ components: [], pages: [], lastUpdated: 0 });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lang: Language = settings?.language || 'de';

  useEffect(() => {
    // Add global styles
    const styleTag = document.createElement('style');
    styleTag.innerHTML = globalStyles;
    document.head.appendChild(styleTag);

    // Initial load
    loadSettings();
    const interval = setInterval(checkSelection, 2000);

    return () => clearInterval(interval);
  }, []);

  const loadSettings = () => {
    // Using localStorage as a simple persistent storage for the add-in
    const stored = localStorage.getItem('audion-plugin-settings');
    if (stored) {
      const parsed = JSON.parse(stored) as PluginSettings;
      setSettings(parsed);
      if (parsed.audionApiUrl) {
        setApiBaseUrl(parsed.audionApiUrl);
      }
      if (parsed.authToken) {
        setAuthToken(parsed.authToken);
        setView('chat');
      } else {
        setView('login');
      }
      if (parsed.brandColor) {
        document.documentElement.style.setProperty('--msqdx-primary', parsed.brandColor);
      }
    } else {
      setView('login');
    }
  };

  const checkSelection = async () => {
    const sel = await OfficeService.getSelection();
    setSelection(sel);
  };

  const handleSettingsChange = (newSettings: PluginSettings) => {
    setSettings(newSettings);
    localStorage.setItem('audion-plugin-settings', JSON.stringify(newSettings));
    if (newSettings.brandColor) {
      document.documentElement.style.setProperty('--msqdx-primary', newSettings.brandColor);
    }
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

      const data = (await response.json()) as {
        access_token: string;
        user?: { id?: string; plexon_user_id?: string | null };
      };
      const token = data.access_token;
      const usageUserId = data.user?.plexon_user_id ?? data.user?.id;

      const newSettings: PluginSettings = {
        ...settings,
        authToken: token,
        audionApiUrl: settings?.audionApiUrl || URL_CONFIG.AUDION_API_BASE,
        ...(usageUserId ? { usageUserId } : {}),
      } as PluginSettings;
      
      handleSettingsChange(newSettings);
      setAuthToken(token);
      setApiBaseUrl(newSettings.audionApiUrl);
      setView('chat');
    } catch (err: any) {
      setLoginError(err.message || 'An error occurred during login');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('audion-plugin-settings');
    setSettings(null);
    setView('login');
  };

  const handlePersonaSelect = (persona: Persona | null) => {
    setSelectedPersona(persona);
  };

  const navButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    height: '28px',
    borderColor: active ? 'var(--msqdx-primary)' : 'var(--msqdx-border-color)',
    background: active ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.85)',
    color: active ? 'var(--msqdx-primary)' : 'var(--msqdx-text-primary)',
    backdropFilter: 'blur(8px)',
  });

  if (view === 'login') {
    return (
      <MsqdxPluginAppShell>
        <LoginPanel
          onLoginData={handleLoginData}
          isLoading={isLoggingIn}
          error={loginError}
          lang={lang}
        />
      </MsqdxPluginAppShell>
    );
  }

  return (
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
            onClick={() => setView('settings')}
            className={'msqdx-button secondary' + (view === 'settings' ? ' active' : '')}
            title={t('setup', lang)}
            style={navButtonStyle(view === 'settings')}
          >
            <span className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '700' }}>
              {t('settings', lang)}
            </span>
          </button>
        </>
      }
    >
      {view === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', overflow: 'hidden' }}>
          <PersonaSelector
            selectedPersonaId={selectedPersona?.id ?? null}
            defaultPersonaId={settings?.defaultPersonaId}
            onPersonaSelect={handlePersonaSelect}
            lang={lang}
          />
          <SelectionInfo selection={selection} lang={lang} />
          <ChatPanel
            selection={selection}
            selectedPersona={selectedPersona}
            settings={settings}
            lang={lang}
            onMessageSent={() => {}}
          />
        </div>
      )}
      {view === 'settings' && (
        <SettingsPanel
          settings={settings}
          onSettingsChange={handleSettingsChange}
          onLogout={handleLogout}
          lang={lang}
          onExportKnowledge={() => {}}
          onImportKnowledge={() => {}}
          onScanComponents={() => {}}
        />
      )}
    </MsqdxPluginAppShell>
  );
}
