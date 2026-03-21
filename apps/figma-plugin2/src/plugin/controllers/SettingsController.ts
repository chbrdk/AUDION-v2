import { URL_CONFIG } from '../../config/urls';

export const SettingsController = {
  async getSettings() {
    try {
      const settings = await figma.clientStorage.getAsync('audion-settings');
      const defaultSettings = {
        audionApiUrl: URL_CONFIG.AUDION_API_BASE,
        ragApiUrl: URL_CONFIG.RAG_API_BASE,
        htmlToFigmaImageDebug: false,
        opalDiscoveryUrl: URL_CONFIG.OPAL_DISCOVERY_URL || undefined,
      };
      figma.ui.postMessage({
        type: 'settings-loaded',
        settings: settings ? { ...defaultSettings, ...settings } : defaultSettings,
      });
    } catch (error) {
      figma.ui.postMessage({
        type: 'settings-loaded',
        settings: {
          audionApiUrl: URL_CONFIG.AUDION_API_BASE,
          ragApiUrl: URL_CONFIG.RAG_API_BASE,
          htmlToFigmaImageDebug: false,
          opalDiscoveryUrl: URL_CONFIG.OPAL_DISCOVERY_URL || undefined,
        },
      });
    }
  },

  async saveSettings(msg: any) {
    try {
      await figma.clientStorage.setAsync('audion-settings', msg.settings);
      figma.ui.postMessage({
        type: 'settings-saved',
      });
    } catch (error) {
      figma.ui.postMessage({
        type: 'settings-error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
};
