import React, { useState, useEffect } from 'react';
import type { PluginSettings, Persona } from '../types';
import { getApiBaseUrl, setApiBaseUrl, listProjects } from '../api/audion-client';
import { URL_CONFIG } from '../config/urls';
import { listPersonas } from '../api/audion-client';
import { BrandColorSelector } from './BrandColorSelector';
import { t, Language } from '../translations';
import { Project } from '../types';

const STORAGE_KEY_SETTINGS = 'audion-settings';

export async function loadSettings(): Promise<PluginSettings> {
  // Request settings from plugin code via message
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg.type === 'settings-loaded') {
        window.removeEventListener('message', handler);
        resolve(msg.settings || { audionApiUrl: getApiBaseUrl(), opalDiscoveryUrl: URL_CONFIG.OPAL_DISCOVERY_URL || undefined });
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
  initialSettings: PluginSettings;
  onSettingsChange?: (settings: PluginSettings) => void;
}

export function SettingsPanel({ initialSettings, onSettingsChange }: SettingsPanelProps) {
  const [settings, setSettings] = useState<PluginSettings>(initialSettings);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const lang: Language = settings.language || 'de';

  useEffect(() => {
    // Sync if props change
    setSettings(initialSettings);
  }, [initialSettings]);

  useEffect(() => {
    if (settings.audionApiUrl) {
      loadPersonas();
      loadProjects();
    }
  }, [settings.audionApiUrl]);

  const loadProjects = async () => {
    try {
      const response: any = await listProjects(1, 100);
      const projectList = Array.isArray(response) ? response : (response?.items || []);
      setProjects(projectList);
    } catch (error) {
      console.error('Failed to load projects for settings:', error);
      setProjects([]);
    }
  };

  const loadPersonas = async () => {
    try {
      const response: any = await listPersonas(1, 100);
      const personaList = Array.isArray(response) ? response : (response?.items || []);
      setPersonas(personaList);
    } catch (error) {
      console.error('Failed to load personas for settings:', error);
      setPersonas([]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      await saveSettings(settings);
      setApiBaseUrl(settings.audionApiUrl);
      setSaveMessage(t('saveSuccess', lang));
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
    if (!confirm(t('confirmClear', lang))) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const handler = (event: MessageEvent) => {
        const msg = event.data.pluginMessage;
        if (msg.type === 'conversations-cleared') {
          window.removeEventListener('message', handler);
          setSaveMessage(t('historyCleared', lang));
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
            {t('apiUrl', lang)}
          </label>
          <input
            type="text"
            value={settings.audionApiUrl}
            onChange={(e) =>
              setSettings({ ...settings, audionApiUrl: e.target.value })
            }
            placeholder="https://api.audion.tech"
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(15,23,42,0.03)',
              border: '1px solid var(--msqdx-border-color)',
              borderRadius: '10px',
              fontSize: '13px',
              color: 'var(--msqdx-text-main)',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
            {t('discoveryUrl', lang)}
          </label>
          <input
            type="text"
            value={settings.opalDiscoveryUrl || ''}
            onChange={(e) =>
              setSettings({ ...settings, opalDiscoveryUrl: e.target.value || undefined })
            }
            placeholder={t('discoveryUrlPlaceholder', lang)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(15,23,42,0.03)',
              border: '1px solid var(--msqdx-border-color)',
              borderRadius: '10px',
              fontSize: '13px',
              color: 'var(--msqdx-text-main)',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
            {t('ragApiUrl', lang)}
          </label>
          <input
            type="text"
            value={settings.ragApiUrl || ''}
            onChange={(e) =>
              setSettings({ ...settings, ragApiUrl: e.target.value || undefined })
            }
            placeholder={t('ragApiUrlPlaceholder', lang)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(15,23,42,0.03)',
              border: '1px solid var(--msqdx-border-color)',
              borderRadius: '10px',
              fontSize: '13px',
              color: 'var(--msqdx-text-main)',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
            {t('creationPluginApiSecret', lang)}
          </label>
          <input
            type="password"
            autoComplete="off"
            value={settings.creationPluginApiSecret || ''}
            onChange={(e) =>
              setSettings({ ...settings, creationPluginApiSecret: e.target.value || undefined })
            }
            placeholder="••••••••"
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(15,23,42,0.03)',
              border: '1px solid var(--msqdx-border-color)',
              borderRadius: '10px',
              fontSize: '13px',
              color: 'var(--msqdx-text-main)',
              outline: 'none',
            }}
          />
          <p className="msqdx-mono" style={{ fontSize: '9px', color: 'var(--msqdx-text-secondary)', margin: 0, lineHeight: 1.35 }}>
            {t('creationPluginApiSecretHint', lang)}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
            {t('htmlToFigmaImageDebug', lang)}
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              border: '1px solid var(--msqdx-border-color)',
              borderRadius: '10px',
              background: 'rgba(15,23,42,0.03)',
              cursor: 'pointer'
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(settings.htmlToFigmaImageDebug)}
              onChange={(e) =>
                setSettings({ ...settings, htmlToFigmaImageDebug: e.target.checked })
              }
            />
            <span className="msqdx-mono" style={{ fontSize: '10px', color: 'var(--msqdx-text-secondary)' }}>
              {t('htmlToFigmaImageDebugHint', lang)}
            </span>
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
            {t('selectProject', lang)}
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={settings.projectId || ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  projectId: e.target.value || undefined,
                })
              }
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'rgba(15,23,42,0.03)',
                border: '1px solid var(--msqdx-border-color)',
                borderRadius: '10px',
                fontSize: '13px',
                color: 'var(--msqdx-text-main)',
                outline: 'none',
                appearance: 'none'
              }}
            >
              <option value="">{t('selectProject', lang)}</option>
              {(projects || []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
            {t('defaultPersona', lang)}
          </label>
          <div style={{ position: 'relative' }}>
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
                padding: '10px 14px',
                background: 'rgba(15,23,42,0.03)',
                border: '1px solid var(--msqdx-border-color)',
                borderRadius: '10px',
                fontSize: '13px',
                color: 'var(--msqdx-text-main)',
                outline: 'none',
                appearance: 'none'
              }}
            >
              <option value="">{t('noDefaultPersona', lang)}</option>
              {(personas || []).map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.name} ({persona.segment})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
            {t('language', lang)}
          </label>
          <select
            value={settings.language || 'de'}
            onChange={(e) =>
              setSettings({
                ...settings,
                language: e.target.value as Language,
              })
            }
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(15,23,42,0.03)',
              border: '1px solid var(--msqdx-border-color)',
              borderRadius: '10px',
              fontSize: '13px',
              color: 'var(--msqdx-text-main)',
              outline: 'none',
              appearance: 'none'
            }}
          >
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
            {t('openAiApiKey', lang)}
          </label>
          <input
            type="password"
            value={settings.openAiApiKey || ''}
            onChange={(e) =>
              setSettings({ ...settings, openAiApiKey: e.target.value })
            }
            placeholder="sk-..."
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(15,23,42,0.03)',
              border: '1px solid var(--msqdx-border-color)',
              borderRadius: '10px',
              fontSize: '13px',
              color: 'var(--msqdx-text-main)',
              outline: 'none'
            }}
          />
        </div>

        <BrandColorSelector 
          selectedColor={settings.brandColor || '#0f172a'} 
          onColorSelect={(color) => setSettings({ ...settings, brandColor: color })}
        />

        {saveMessage !== null && (
          <div
            className="msqdx-mono"
            style={{
              padding: '10px',
              borderRadius: '8px',
              fontSize: '11px',
              backgroundColor: (saveMessage as string).indexOf('Error') !== -1
                ? 'rgba(220, 38, 38, 0.05)'
                : 'rgba(0, 202, 85, 0.05)',
              color: (saveMessage as string).indexOf('Error') !== -1 ? '#dc2626' : '#00ca55',
              border: '1px solid ' + ((saveMessage as string).indexOf('Error') !== -1 ? 'rgba(220, 38, 38, 0.15)' : 'rgba(0, 202, 85, 0.15)'),
              textAlign: 'center'
            }}
          >
            {(saveMessage as string).toUpperCase()}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="msqdx-button"
            style={{
              flex: 1,
              height: '42px',
              borderRadius: '12px',
            }}
          >
            <span className="msqdx-mono">{isSaving ? t('saving', lang) : t('saveSettings', lang)}</span>
          </button>
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--msqdx-border-color)',
          paddingTop: '20px',
          marginTop: '10px'
        }}
      >
        <div 
          className="msqdx-mono" 
          style={{ 
            fontSize: '9px', 
            fontWeight: '600', 
            color: 'var(--msqdx-text-secondary)',
            marginBottom: '12px'
          }}
        >
          {t('dangerZone', lang)}
        </div>
        <button
          onClick={handleClearHistory}
          className="msqdx-button secondary"
          style={{
            width: '100%',
            height: '40px',
            borderColor: '#dc2626',
            color: '#dc2626'
          }}
        >
          <span className="msqdx-mono">{t('clearHistory', lang)}</span>
        </button>
      </div>
    </div>
  );
}

