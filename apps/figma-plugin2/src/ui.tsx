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
} from './types';
import { generateConversationId } from './services/conversation-service';
import { LoginPanel } from './components/LoginPanel';
import { setAuthToken, setApiBaseUrl } from './api/audion-client';

type View = 'chat' | 'settings' | 'login';

function App() {
  const [view, setView] = useState<View>('chat');
  const [selection, setSelection] = useState<SelectionMetadata | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [conversation, setConversation] = useState<ConversationHistory | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [settings, setSettings] = useState<PluginSettings | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {

    // Listen for messages from plugin code
    const messageHandler = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;

      switch (msg.type) {
        case 'settings-loaded':
          setSettings(msg.settings);
          if (msg.settings.audionApiUrl) {
            setApiBaseUrl(msg.settings.audionApiUrl);
          }
          if (!msg.settings.authToken) {
            setView('login');
          } else {
            setAuthToken(msg.settings.authToken);
            setView('chat');
          }
          break;

        case 'selection-data':
        case 'selection-changed':
          setSelection(msg.selection);
          break;

        case 'selection-cleared':
        case 'no-selection':
          setSelection(null);
          break;

        case 'screenshot-captured':
          setScreenshot(msg.screenshot);
          break;

        case 'conversation-loaded':
          setConversation(msg.conversation);
          break;

        case 'error':
          console.error('Plugin error:', msg.error);
          break;
      }
    };

    window.addEventListener('message', messageHandler);

    // Request initial selection and settings
    parent.postMessage({ pluginMessage: { type: 'get-selection' } }, '*');
    parent.postMessage({ pluginMessage: { type: 'get-settings' } }, '*');

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  useEffect(() => {
    // Load conversation when selection or persona changes
    if (selection && selectedPersona) {
      const conversationId = generateConversationId(
        selection.nodeId,
        selectedPersona.id
      );

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

      // Capture screenshot
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
  }, [selection, selectedPersona]);

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
    // Reload page to apply new API URL
    window.location.reload();
  };

  const handleLoginData = async (email: string, password: string) => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const authUrl = `${settings?.audionApiUrl || 'https://audion.projects-a.plygrnd.tech'}/api/auth/login`;

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

      const newSettings = { ...settings, authToken: token, audionApiUrl: settings?.audionApiUrl || 'https://audion.projects-a.plygrnd.tech' };
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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {view !== 'login' && (
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #e0e0e0',
          backgroundColor: '#fff',
        }}
      >
        <button
          onClick={() => setView('chat')}
          style={{
            flex: 1,
            padding: '12px',
            border: 'none',
            backgroundColor: view === 'chat' ? '#f5f5f5' : 'transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: view === 'chat' ? '500' : '400',
          }}
        >
          Chat
        </button>
        <button
          onClick={() => setView('settings')}
          style={{
            flex: 1,
            padding: '12px',
            border: 'none',
            backgroundColor: view === 'settings' ? '#f5f5f5' : 'transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: view === 'settings' ? '500' : '400',
          }}
        >
          Settings
        </button>
      </div>
      )}

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {view === 'login' && (
          <LoginPanel 
            onLoginData={handleLoginData} 
            isLoading={isLoggingIn} 
            error={loginError} 
          />
        )}
        {view === 'chat' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              padding: '12px',
              gap: '12px',
            }}
          >
            <SelectionInfo selection={selection} />
            <PersonaSelector
              selectedPersonaId={selectedPersona?.id || null}
              defaultPersonaId={settings?.defaultPersonaId}
              onPersonaSelect={handlePersonaSelect}
            />
            <div style={{ flex: 1, minHeight: 0 }}>
              <ChatPanel
                persona={selectedPersona}
                conversationId={conversation?.conversationId || null}
                selectionMetadata={selection}
                screenshot={screenshot}
                onMessageSent={handleMessageSent}
              />
            </div>
          </div>
        )}

        {view === 'settings' && (
          <SettingsPanel onSettingsChange={handleSettingsChange} />
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

