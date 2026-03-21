import React, { useState, useEffect } from 'react';
import type { PluginSettings, Persona, Project } from '../types';
import { setApiBaseUrl, listProjects, listPersonas } from '../api/audion-client';
import { BrandColorSelector } from './BrandColorSelector';
import { t, Language } from '../translations';

interface SettingsPanelProps {
  settings: PluginSettings | null;
  onSettingsChange: (settings: PluginSettings) => void;
  onLogout: () => void;
  lang: Language;
  onExportKnowledge: () => void;
  onImportKnowledge: () => void;
  onScanComponents: () => void;
}

export function SettingsPanel({ 
  settings: initialSettings, 
  onSettingsChange, 
  onLogout,
  lang,
  onExportKnowledge,
  onImportKnowledge,
  onScanComponents
}: SettingsPanelProps) {
  const [settings, setSettings] = useState<PluginSettings>(initialSettings || { audionApiUrl: '' });
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
    }
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
      setApiBaseUrl(settings.audionApiUrl);
      onSettingsChange(settings);
      setSaveMessage(t('saveSuccess', lang));
      
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

  const handleClearHistory = () => {
    if (confirm(t('confirmClear', lang))) {
      // For PowerPoint, we might just clear local storage or call a backend API
      // Since we don't have a specific "clear history" API yet in this port, 
      // let's just show a message or implement a simple version.
      alert('History cleared (placeholder)');
    }
  };

  return (
    <div className="scroll-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* API URL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
            {t('apiUrl', lang)}
          </label>
          <input
            type="text"
            value={settings.audionApiUrl}
            onChange={(e) => setSettings({ ...settings, audionApiUrl: e.target.value })}
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

        {/* Project Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
            {t('selectProject', lang)}
          </label>
          <select
            value={settings.projectId || ''}
            onChange={(e) => setSettings({ ...settings, projectId: e.target.value || undefined })}
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
          >
            <option value="">{t('selectProject', lang)}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Default Persona */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
            {t('defaultPersona', lang)}
          </label>
          <select
            value={settings.defaultPersonaId || ''}
            onChange={(e) => setSettings({ ...settings, defaultPersonaId: e.target.value || undefined })}
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
          >
            <option value="">{t('noDefaultPersona', lang)}</option>
            {personas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Brand Color */}
        <BrandColorSelector 
          selectedColor={settings.brandColor || '#3b82f6'} 
          onColorSelect={(color) => setSettings({ ...settings, brandColor: color })}
        />

        {/* OpenAI API Key */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
            {t('openAiApiKey', lang)}
          </label>
          <input
            type="password"
            value={settings.openAiApiKey || ''}
            onChange={(e) => setSettings({ ...settings, openAiApiKey: e.target.value })}
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

        {saveMessage && (
          <div style={{ fontSize: '11px', color: saveMessage.includes('Error') ? 'red' : 'green', textAlign: 'center' }}>
            {saveMessage}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="msqdx-button"
          style={{ width: '100%' }}
        >
          {isSaving ? t('saving', lang) : t('saveSettings', lang)}
        </button>

        <button
          onClick={onLogout}
          className="msqdx-button secondary"
          style={{ width: '100%', color: 'var(--msqdx-orange)' }}
        >
          {t('logout', lang)}
        </button>
      </div>
    </div>
  );
}
