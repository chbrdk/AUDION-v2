import type {
  Persona,
  SelectionMetadata,
  ConversationHistory,
  ChatMessage,
  PluginSettings,
} from './types';
import { generateConversationId } from './services/conversation-service';
import { sendMessage, uploadImage, listPersonas } from './api/audion-client';
import type { ChatRequest } from './types';

type View = 'chat' | 'settings';

interface AppState {
  view: View;
  selection: SelectionMetadata | null;
  selectedPersona: Persona | null;
  conversation: ConversationHistory | null;
  screenshot: string | null;
  settings: PluginSettings | null;
  personas: Persona[];
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}

class App {
  private state: AppState;
  private container: HTMLElement;

  constructor() {
    this.state = {
      view: 'chat',
      selection: null,
      selectedPersona: null,
      conversation: null,
      screenshot: null,
      settings: null,
      personas: [],
      messages: [],
      isLoading: false,
      error: null,
    };

    const container = document.getElementById('react-page');
    if (!container) {
      throw new Error('Container not found');
    }
    this.container = container;

    // Render initial empty state
    this.render();

    this.init();
  }

  private async init(): Promise<void> {
    // Listen for messages from plugin code
    window.onmessage = (event) => {
      this.handlePluginMessage(event.data.pluginMessage);
    };

    // Request initial selection and settings
    this.sendToPlugin({ type: 'get-selection' });
    this.sendToPlugin({ type: 'get-settings' });

    // Load personas
    this.loadPersonas();

    // Render initial UI
    this.render();
  }

  private sendToPlugin(message: any): void {
    parent.postMessage({ pluginMessage: message }, '*');
  }

  private handlePluginMessage(msg: any): void {
    switch (msg.type) {
      case 'settings-loaded':
        this.state.settings = msg.settings || { audionApiUrl: 'https://audion.projects-a.plygrnd.tech' };
        this.render();
        break;

      case 'selection-data':
      case 'selection-changed':
        this.state.selection = msg.selection;
        this.handleSelectionChange();
        this.render();
        break;

      case 'selection-cleared':
      case 'no-selection':
        this.state.selection = null;
        this.render();
        break;

      case 'screenshot-captured':
        this.state.screenshot = msg.screenshot;
        this.render();
        break;

      case 'conversation-loaded':
        this.state.conversation = msg.conversation;
        this.state.messages = msg.conversation?.messages || [];
        this.render();
        break;

      case 'error':
        console.error('Plugin error:', msg.error);
        this.state.error = msg.error;
        this.render();
        break;
    }
  }

  private handleSelectionChange(): void {
    if (this.state.selection && this.state.selectedPersona) {
      const conversationId = generateConversationId(
        this.state.selection.nodeId,
        this.state.selectedPersona.id
      );

      this.sendToPlugin({
        type: 'get-conversation',
        selectionId: this.state.selection.nodeId,
        personaId: this.state.selectedPersona.id,
      });

      this.sendToPlugin({
        type: 'capture-screenshot',
        nodeId: this.state.selection.nodeId,
      });
    }
  }

  private async loadPersonas(): Promise<void> {
    try {
      const apiUrl = this.state.settings?.audionApiUrl || 'https://audion.projects-a.plygrnd.tech';
      // Set API URL temporarily
      const { setApiBaseUrl } = await import('./api/audion-client');
      setApiBaseUrl(apiUrl);

      const response = await listPersonas(1, 100);
      this.state.personas = response.items;
      this.render();
    } catch (error) {
      console.error('Failed to load personas:', error);
    }
  }

  private async handleSendMessage(input: HTMLInputElement): Promise<void> {
    const message = input.value.trim();
    if (!message || !this.state.selectedPersona || !this.state.conversation) {
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };

    this.state.messages.push(userMessage);
    input.value = '';
    this.state.isLoading = true;
    this.state.error = null;
    this.render();

    try {
      // Upload screenshot if available
      let imageIds: string[] | undefined;
      if (this.state.screenshot) {
        try {
          const imageId = await uploadImage(this.state.screenshot);
          imageIds = [imageId];
        } catch (error) {
          console.warn('Failed to upload screenshot:', error);
        }
      }

      const request: ChatRequest = {
        persona_id: this.state.selectedPersona.id,
        messages: [
          ...this.state.messages.map((m) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
            image_ids: m.imageIds,
          })),
          {
            role: 'user',
            content: message,
            image_ids: imageIds,
          },
        ],
        conversation_id: this.state.conversation.conversationId,
        metadata: this.state.selection
          ? {
              selection: this.state.selection,
              figma_file_id: this.state.selection.nodeId,
            }
          : undefined,
      };

      const response = await sendMessage(request);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
        timestamp: Date.now(),
      };

      this.state.messages.push(assistantMessage);
      this.sendToPlugin({
        type: 'get-conversation',
        selectionId: this.state.selection!.nodeId,
        personaId: this.state.selectedPersona.id,
      });
    } catch (error) {
      this.state.error = error instanceof Error ? error.message : 'Failed to send message';
      console.error('Chat error:', error);
    } finally {
      this.state.isLoading = false;
      this.render();
    }
  }

  private handlePersonaSelect(personaId: string): void {
    const persona = this.state.personas.find((p) => p.id === personaId);
    this.state.selectedPersona = persona || null;
    this.handleSelectionChange();
    this.render();
  }

  private setView(view: View): void {
    this.state.view = view;
    this.render();
  }

  private render(): void {
    console.log('Rendering, view:', this.state.view);
    try {
      if (this.state.view === 'chat') {
        this.renderChatView();
      } else {
        this.renderSettingsView();
      }
    } catch (error) {
      console.error('Render error:', error);
      this.container.innerHTML = `
        <div style="padding: 20px; color: red;">
          <h3>Render Error</h3>
          <p>${error instanceof Error ? error.message : String(error)}</p>
        </div>
      `;
    }
  }

  private renderChatView(): void {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100vh; font-family: Inter, sans-serif;">
        <div style="display: flex; border-bottom: 1px solid #e0e0e0; background-color: #fff;">
          <button id="btn-chat" style="flex: 1; padding: 12px; border: none; background-color: #f5f5f5; cursor: pointer; font-size: 14px; font-weight: 500;">Chat</button>
          <button id="btn-settings" style="flex: 1; padding: 12px; border: none; background-color: transparent; cursor: pointer; font-size: 14px; font-weight: 400;">Settings</button>
        </div>
        <div style="flex: 1; overflow: hidden; padding: 12px; display: flex; flex-direction: column; gap: 12px;">
          ${this.renderSelectionInfo()}
          ${this.renderPersonaSelector()}
          <div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
            ${this.renderChatPanel()}
          </div>
        </div>
      </div>
    `;

    // Attach event listeners
    document.getElementById('btn-chat')?.addEventListener('click', () => this.setView('chat'));
    document.getElementById('btn-settings')?.addEventListener('click', () => this.setView('settings'));
    document.getElementById('persona-select')?.addEventListener('change', (e) => {
      const select = e.target as HTMLSelectElement;
      this.handlePersonaSelect(select.value);
    });

    const input = document.getElementById('chat-input') as HTMLInputElement;
    const sendBtn = document.getElementById('chat-send');
    
    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage(input);
      }
    });
    
    sendBtn?.addEventListener('click', () => {
      if (input) {
        this.handleSendMessage(input);
      }
    });
  }

  private renderSelectionInfo(): string {
    if (!this.state.selection) {
      return `
        <div style="padding: 12px; background-color: #fff3cd; border-radius: 4px; font-size: 14px; color: #856404;">
          Please select an Artboard, Group, or Frame to start chatting.
        </div>
      `;
    }

    return `
      <div style="padding: 12px; background-color: #f5f5f5; border-radius: 4px; font-size: 14px;">
        <div style="font-weight: 500; margin-bottom: 4px;">${this.state.selection.name}</div>
        <div style="color: #666; font-size: 12px;">Type: ${this.state.selection.type}</div>
        <div style="color: #666; font-size: 12px;">Size: ${Math.round(this.state.selection.bounds.width)} × ${Math.round(this.state.selection.bounds.height)}px</div>
      </div>
    `;
  }

  private renderPersonaSelector(): string {
    const selectedId = this.state.selectedPersona?.id || '';
    const defaultId = this.state.settings?.defaultPersonaId || '';

    return `
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <label style="font-size: 12px; font-weight: 500; color: #666;">Select Persona</label>
        <select id="persona-select" style="padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px; background-color: #fff;" value="${selectedId || defaultId}">
          <option value="">-- Select a persona --</option>
          ${this.state.personas.map((p) => `
            <option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>
              ${p.name} (${p.segment})
            </option>
          `).join('')}
        </select>
        ${this.state.selectedPersona ? `
          <div style="padding: 8px; background-color: #f5f5f5; border-radius: 4px; font-size: 12px; margin-top: 4px;">
            <div style="font-weight: 500">${this.state.selectedPersona.name}</div>
            ${this.state.selectedPersona.headline ? `<div style="color: #666; margin-top: 4px;">${this.state.selectedPersona.headline}</div>` : ''}
            <div style="color: #999; margin-top: 4px;">${this.state.selectedPersona.segment}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderChatPanel(): string {
    const canSend = this.state.selectedPersona && !this.state.isLoading;

    return `
      <div style="display: flex; flex-direction: column; height: 100%;">
        <div style="flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
          ${this.state.messages.length === 0 ? `
            <div style="color: #666; text-align: center; padding: 20px; font-size: 14px;">
              ${this.state.selectedPersona ? `Start chatting with ${this.state.selectedPersona.name} about your selection` : 'Select a persona to start chatting'}
            </div>
          ` : ''}
          ${this.state.messages.map((msg) => `
            <div style="align-self: ${msg.role === 'user' ? 'flex-end' : 'flex-start'}; max-width: 80%; padding: 8px 12px; border-radius: 8px; background-color: ${msg.role === 'user' ? '#0d99ff' : '#f0f0f0'}; color: ${msg.role === 'user' ? '#fff' : '#000'}; font-size: 14px; word-wrap: break-word;">
              ${msg.content}
            </div>
          `).join('')}
          ${this.state.isLoading ? `
            <div style="align-self: flex-start; padding: 8px 12px; border-radius: 8px; background-color: #f0f0f0; font-size: 14px;">
              Thinking...
            </div>
          ` : ''}
          ${this.state.error ? `
            <div style="padding: 8px 12px; border-radius: 8px; background-color: #ffebee; color: #c62828; font-size: 14px;">
              Error: ${this.state.error}
            </div>
          ` : ''}
        </div>
        <div style="border-top: 1px solid #e0e0e0; padding: 12px; display: flex; gap: 8px;">
          <input
            id="chat-input"
            type="text"
            placeholder="${this.state.selectedPersona ? 'Type your message...' : 'Select a persona first'}"
            disabled="${!this.state.selectedPersona || this.state.isLoading}"
            style="flex: 1; padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px;"
          />
          <button
            id="chat-send"
            disabled="${!canSend}"
            style="padding: 8px 16px; background-color: ${canSend ? '#0d99ff' : '#ccc'}; color: #fff; border: none; border-radius: 4px; cursor: ${canSend ? 'pointer' : 'not-allowed'}; font-size: 14px;"
          >
            Send
          </button>
        </div>
      </div>
    `;
  }

  private renderSettingsView(): void {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100vh; font-family: Inter, sans-serif;">
        <div style="display: flex; border-bottom: 1px solid #e0e0e0; background-color: #fff;">
          <button id="btn-chat" style="flex: 1; padding: 12px; border: none; background-color: transparent; cursor: pointer; font-size: 14px; font-weight: 400;">Chat</button>
          <button id="btn-settings" style="flex: 1; padding: 12px; border: none; background-color: #f5f5f5; cursor: pointer; font-size: 14px; font-weight: 500;">Settings</button>
        </div>
        <div style="flex: 1; overflow: hidden; padding: 12px;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 500;">Settings</h3>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div>
              <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px; color: #666;">AUDION API URL</label>
              <input
                id="api-url"
                type="text"
                value="${this.state.settings?.audionApiUrl || 'https://audion.projects-a.plygrnd.tech'}"
                placeholder="https://audion.projects-a.plygrnd.tech"
                style="width: 100%; padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px;"
              />
            </div>
            <button
              id="save-settings"
              style="padding: 8px 16px; background-color: #0d99ff; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-chat')?.addEventListener('click', () => this.setView('chat'));
    document.getElementById('btn-settings')?.addEventListener('click', () => this.setView('settings'));
    
    document.getElementById('save-settings')?.addEventListener('click', () => {
      const input = document.getElementById('api-url') as HTMLInputElement;
      if (input && this.state.settings) {
        this.state.settings.audionApiUrl = input.value;
        this.sendToPlugin({
          type: 'save-settings',
          settings: this.state.settings,
        });
        // Reload page to apply new API URL
        window.location.reload();
      }
    });
  }
}

// Initialize app when DOM is ready
console.log('UI script loaded, readyState:', document.readyState);
console.log('Container element:', document.getElementById('react-page'));

try {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('DOMContentLoaded fired, initializing app');
      new App();
    });
  } else {
    console.log('DOM already ready, initializing app immediately');
    new App();
  }
} catch (error) {
  console.error('Failed to initialize app:', error);
  const container = document.getElementById('react-page');
  if (container) {
    container.innerHTML = `
      <div style="padding: 20px; color: red;">
        <h3>Error initializing plugin</h3>
        <p>${error instanceof Error ? error.message : String(error)}</p>
        <p>Check console for details.</p>
      </div>
    `;
  }
}

