import {
  getSelectionMetadata,
  validateSelection,
  getSelectedNodes,
} from './services/selection-service';
import { captureSelectionAsBase64 } from './services/screenshot-service';
import {
  generateConversationId,
  loadConversation,
  createConversation,
  addMessageToConversation,
} from './services/conversation-service';
import { getFigmaFileId } from './api/figma-api';
import type { SelectionMetadata } from './types';

// Show the plugin UI
figma.showUI(__html__, {
  width: 400,
  height: 600,
  themeColors: true,
});

// Handle selection changes
figma.on('selectionchange', () => {
  const selection = getSelectedNodes();
  const isValid = validateSelection(selection);

  if (isValid && selection.length > 0) {
    const metadata = getSelectionMetadata();
    if (metadata) {
      figma.ui.postMessage({
        type: 'selection-changed',
        selection: metadata,
      });
    }
  } else {
    figma.ui.postMessage({
      type: 'selection-cleared',
    });
  }
});

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  try {
    switch (msg.type) {
      case 'get-settings': {
        try {
          const settings = await figma.clientStorage.getAsync('audion-settings');
          figma.ui.postMessage({
            type: 'settings-loaded',
            settings: settings || { audionApiUrl: 'https://192.168.50.101/audion/api' },
          });
        } catch (error) {
          figma.ui.postMessage({
            type: 'settings-loaded',
            settings: { audionApiUrl: 'https://192.168.50.101/audion/api' },
          });
        }
        break;
      }

      case 'save-settings': {
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
        break;
      }

      case 'get-selection': {
        const selection = getSelectedNodes();
        const isValid = validateSelection(selection);

        if (isValid && selection.length > 0) {
          const metadata = getSelectionMetadata();
          if (metadata) {
            figma.ui.postMessage({
              type: 'selection-data',
              selection: metadata,
            });
          }
        } else {
          figma.ui.postMessage({
            type: 'no-selection',
          });
        }
        break;
      }

      case 'capture-screenshot': {
        const { nodeId } = msg;
        const node = figma.getNodeById(nodeId) as SceneNode;

        if (!node) {
          figma.ui.postMessage({
            type: 'screenshot-error',
            error: 'Node not found',
          });
          return;
        }

        try {
          const screenshotBase64 = await captureSelectionAsBase64(node);
          figma.ui.postMessage({
            type: 'screenshot-captured',
            screenshot: screenshotBase64,
            nodeId,
          });
        } catch (error) {
          figma.ui.postMessage({
            type: 'screenshot-error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        break;
      }

      case 'get-conversation': {
        const { selectionId, personaId } = msg;
        const conversationId = generateConversationId(selectionId, personaId);

        let conversation = await loadConversation(conversationId);

        if (!conversation) {
          conversation = await createConversation(
            conversationId,
            personaId,
            selectionId
          );
        }

        figma.ui.postMessage({
          type: 'conversation-loaded',
          conversation,
        });
        break;
      }

      case 'save-message': {
        const { conversationId, message } = msg;
        await addMessageToConversation(conversationId, message);
        figma.ui.postMessage({
          type: 'message-saved',
        });
        break;
      }

      case 'clear-all-conversations': {
        try {
          await figma.clientStorage.setAsync('audion-conversations', {});
          figma.ui.postMessage({
            type: 'conversations-cleared',
          });
        } catch (error) {
          figma.ui.postMessage({
            type: 'conversations-error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        break;
      }

      case 'resize': {
        const { width, height } = msg;
        figma.ui.resize(width, height);
        break;
      }

      default:
        console.warn('Unknown message type:', msg.type);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    figma.ui.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Send initial selection on plugin load
const initialSelection = getSelectedNodes();
if (validateSelection(initialSelection) && initialSelection.length > 0) {
  const metadata = getSelectionMetadata();
  if (metadata) {
    figma.ui.postMessage({
      type: 'selection-data',
      selection: metadata,
    });
  }
}

