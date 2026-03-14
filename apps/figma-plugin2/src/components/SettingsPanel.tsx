import React, { useState, useEffect } from 'react';
import type { PluginSettings, Persona } from '../types';
import { getApiBaseUrl, setApiBaseUrl } from '../api/audion-client';
import { listPersonas } from '../api/audion-client';

const STORAGE_KEY_SETTINGS = 'audion-settings';

export async function loadSettings(): Promise<PluginSettings> {
  // Request settings from plugin code via message
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg.type === 'settings-loaded') {
        window.removeEventListener('message', handler);
        resolve(msg.settings || { audionApiUrl: getApiBaseUrl() });
      }
    };
    window.addEventListener('message', handler);
    parent.postMessage({ pluginMessage: { type: 'get-settings' } }, '*');
  });
}

async function saveSettings(settings: PluginSettings): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg.type === 'settings-saved') {
        window.removeEventListener('message', handler);
        setApiBaseUrl(settings.audionApiUrl);
        resolve();
      } else if (msg.type === 'settings-error') {
        window.removeEventListener('message', handler);
        reject(new Error(msg.error || 'Failed to save settings'));
      }
    };
    window.addEventListener('message', handler);
    parent.postMessage(
      { pluginMessage: { type: 'save-settings', settings } },
      '*'
    );
  });
}

interface SettingsPanelProps {
  onSettingsChange?: (settings: PluginSettings) => void;
}

export function SettingsPanel({ onSettingsChange }: SettingsPanelProps) {
  const [settings, setSettings] = useState<PluginSettings>({
    audionApiUrl: getApiBaseUrl(),
  });
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings().then((loadedSettings) => {
      setSettings(loadedSettings);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (settings.audionApiUrl) {
      loadPersonas();
    }
  }, [settings.audionApiUrl]);

  const loadPersonas = async () => {
    try {
      const response = await listPersonas(1, 100);
      setPersonas(response.items);
    } catch (error) {
      console.error('Failed to load personas for settings:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      await saveSettings(settings);
      setApiBaseUrl(settings.audionApiUrl);
      setSaveMessage('Settings saved successfully');
      onSettingsChange?.(settings);
      
      // Reload personas with new API URL
      await loadPersonas();
      
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setSaveMessage(
        error instanceof Error ? error.message : 'Failed to save settings'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearHistory = async () => {
    if (
      !confirm(
        'Are you sure you want to clear all conversation history? This cannot be undone.'
      )
    ) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const handler = (event: MessageEvent) => {
        const msg = event.data.pluginMessage;
        if (msg.type === 'conversations-cleared') {
          window.removeEventListener('message', handler);
          setSaveMessage('Conversation history cleared');
          setTimeout(() => setSaveMessage(null), 3000);
          resolve();
        } else if (msg.type === 'conversations-error') {
          window.removeEventListener('message', handler);
          setSaveMessage(
            msg.error || 'Failed to clear conversation history'
          );
          reject(new Error(msg.error));
        }
      };
      window.addEventListener('message', handler);
      parent.postMessage(
        { pluginMessage: { type: 'clear-all-conversations' } },
        '*'
      );
    });
  };

  if (isLoading) {
    return <div style={{ padding: '12px' }}>Loading settings...</div>;
  }

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '500' }}>
          Settings
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                marginBottom: '4px',
                color: '#666',
              }}
            >
              AUDION API URL
            </label>
            <input
              type="text"
              value={settings.audionApiUrl}
              onChange={(e) =>
                setSettings({ ...settings, audionApiUrl: e.target.value })
              }
              placeholder="https://audion.projects-a.plygrnd.tech"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                marginBottom: '4px',
                color: '#666',
              }}
            >
              Default Persona
            </label>
            <select
              value={settings.defaultPersonaId || ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  defaultPersonaId: e.target.value || undefined,
                })
              }
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: '#fff',
              }}
            >
              <option value="">-- No default persona --</option>
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.name} ({persona.segment})
                </option>
              ))}
            </select>
          </div>

          {saveMessage && (
            <div
              style={{
                padding: '8px',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: saveMessage.includes('Error')
                  ? '#ffebee'
                  : '#e8f5e9',
                color: saveMessage.includes('Error') ? '#c62828' : '#2e7d32',
              }}
            >
              {saveMessage}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                flex: 1,
                padding: '8px 16px',
                backgroundColor: '#0d99ff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontSize: '14px',
              }}
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid #e0e0e0',
          paddingTop: '16px',
        }}
      >
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '500' }}>
          Data Management
        </h4>
        <button
          onClick={handleClearHistory}
          style={{
            padding: '8px 16px',
            backgroundColor: '#ff5252',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Clear All Conversation History
        </button>
      </div>
    </div>
  );
}

