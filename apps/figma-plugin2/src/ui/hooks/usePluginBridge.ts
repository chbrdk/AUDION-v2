import { useEffect } from 'react';
import { usePluginStore } from '../store';
import { convertToBase64 } from '../../services/screenshot-service';
import { setAuthToken, setApiBaseUrl } from '../../api/audion-client';
import { parseImportedSectionsPayload } from '../../services/journey-imported-section';

export function usePluginBridge() {
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      const store = usePluginStore.getState();

      switch (msg.type) {
        case 'settings-loaded': {
          const loadedSettings = msg.settings;
          store.setSettings(loadedSettings);
          if (loadedSettings.audionApiUrl) {
            setApiBaseUrl(loadedSettings.audionApiUrl);
          }
          if (!loadedSettings.authToken) {
            store.setView('login');
          } else if (store.view !== 'settings') {
            setAuthToken(loadedSettings.authToken);
            store.setView('chat');
          }
          if (loadedSettings.brandColor) {
            document.documentElement.style.setProperty('--msqdx-primary', loadedSettings.brandColor);
          }
          break;
        }

        case 'selection-data':
        case 'selection-changed':
          store.setSelection(msg.selection);
          break;

        case 'selection-cleared':
        case 'no-selection':
          store.setSelection(null);
          store.setScreenshot(null);
          break;

        case 'screenshot-captured':
          if (msg.screenshotBytes) {
            const base64 = convertToBase64(msg.screenshotBytes);
            store.setScreenshot(base64);
          }
          // Note: isCapturingScreenshot state moved to wherever triggered it
          break;
        
        case 'screenshot-error':
          console.error('Screenshot capture error:', msg.error);
          break;

        case 'conversation-loaded':
          store.setConversation(msg.conversation);
          break;

        case 'wireframe-generated':
        case 'wireframe-error':
          store.setIsGeneratingWireframe(false);
          store.setGenerationProgress(null);
          if (msg.type === 'wireframe-error') {
            console.error('Wireframe generation error:', msg.error);
          }
          break;

        case 'generation-progress':
          store.setGenerationProgress(msg.message);
          break;

        case 'html-to-figma-success':
          store.setHtmlToFigmaLoading(false);
          store.setHtmlToFigmaError(null);
          store.setHtmlToFigmaSuccess(true);
          break;

        case 'html-to-figma-error':
          store.setHtmlToFigmaLoading(false);
          store.setHtmlToFigmaError(msg.error ?? 'Unknown error');
          store.setHtmlToFigmaSuccess(false);
          break;

        case 'prompt-site-to-figma-success': {
          store.setPromptSiteLoading(false);
          store.setPromptSiteError(null);
          store.setPromptSiteSuccess(true);
          store.setPromptSitePreviewUrl(msg.previewUrl ?? null);
          store.setPromptSiteRenderMeta(msg.renderMeta ?? null);
          
          const nextSections = parseImportedSectionsPayload(msg.importedSections);
          store.setJourneyImportedSections(nextSections);
          break;
        }

        case 'prompt-site-to-figma-error':
          store.setPromptSiteLoading(false);
          store.setPromptSiteError(msg.error ?? 'Unknown error');
          store.setPromptSiteSuccess(false);
          store.setPromptSitePreviewUrl(null);
          store.setPromptSiteRenderMeta(null);
          break;

        case 'knowledge-loaded': {
          store.setKnowledgeBase(msg.knowledge);
          store.setIsScanningComponents(false);
          store.setIsScanningPage(false);
          break;
        }

        case 'error':
          console.error('Plugin error:', msg.error);
          break;
          
        // Any other domain specific messages (DSL, RAG) can also be added here similarly...
      }
    };

    window.addEventListener('message', messageHandler);

    // Initial load calls
    parent.postMessage({ pluginMessage: { type: 'get-selection' } }, '*');
    parent.postMessage({ pluginMessage: { type: 'get-settings' } }, '*');
    parent.postMessage({ pluginMessage: { type: 'get-knowledge' } }, '*');

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);
}
