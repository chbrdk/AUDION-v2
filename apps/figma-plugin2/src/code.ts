import {
  getSelectionMetadata,
  validateSelection,
  getSelectedNodes,
} from './services/selection-service';
import { getRAGComponentsFromSelection } from './services/rag-selection-service';
import { captureSelection } from './services/screenshot-service';
import {
  generateConversationId,
  loadConversation,
  createConversation,
  addMessageToConversation,
} from './services/conversation-service';
import type { SelectionMetadata } from './types';
import { scanSelectedComponents } from './agent/scanner';
import { scanSelectedPage } from './agent/page-scanner';
import { KNOWLEDGE_ENRICHMENT_SYSTEM_PROMPT, buildEnrichmentPrompt } from './agent/enrichment-agent';
import { createFrame } from './agent/figma-atoms';
import { createButton, createSection, addText, createStage } from './agent/figma-molecules';
import { executeTool } from './agent/execute-tool';
import { runWireframeToolAgent } from './agent/wireframe-tool-agent';
import { getOrCreateWireframeVariables } from './figma-variables';
import type { ComponentKnowledgeBase } from './types';
import { URL_CONFIG, CREATION_GENERATE_SITE_PREVIEW_PATH, CREATION_GENERATE_SITE_TO_LAYERS_PATH } from './config/urls';
import {
  listDiscoveredTools,
  callDiscoveredTool,
  type FetchLike,
} from './api/discovery-client';
import { parseDSL, DSLParseError, DSLValidationError } from './dsl/parser';
import { resolveTokens } from './dsl/tokens';
import { preloadFontsForDSL } from './dsl/fonts';
import {
  renderChildren,
  type RenderContext,
} from './dsl/renderer';
import { figmaNodeToDSL } from './dsl/reverse/nodeReader';
import { renderComposition } from './composition/renderer';
import { runRagRefinementAgent } from './agent/rag-refinement-agent';
import { addLayersToFrame, defaultFont } from './html-figma/figma';

/** Figma plugin fetch only accepts method, headers, body. Pass only these to avoid "Unrecognized key(s): signal". */
function figmaFetch(
  url: string,
  opts: { method: string; headers: Record<string, string>; body: string }
): Promise<Response> {
  return fetch(url, {
    method: opts.method,
    headers: opts.headers,
    body: opts.body,
  });
}

/** Figma fetch does not support 'signal'; use Promise.race for timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        const err = new Error(message);
        (err as Error & { name: string }).name = 'AbortError';
        reject(err);
      }, ms)
    ),
  ]);
}

const STORAGE_KEY_KNOWLEDGE = 'audion-knowledge-base';

function normalizeKnowledge(raw: unknown): ComponentKnowledgeBase {
  if (!raw || typeof raw !== 'object') {
    return { components: [], pages: [], lastUpdated: Date.now() };
  }
  const o = raw as Record<string, unknown>;
  const components = Array.isArray(o.components) ? o.components : [];
  const pages = Array.isArray(o.pages) ? o.pages : [];
  const lastUpdated = typeof o.lastUpdated === 'number' ? o.lastUpdated : Date.now();
  return { components, pages, lastUpdated } as ComponentKnowledgeBase;
}

// Improved Polyfill for TextDecoder as it's missing in Figma sandbox
if (typeof (globalThis as any).TextDecoder === "undefined") {
  (globalThis as any).TextDecoder = class TextDecoder {
    decode(uint8array: Uint8Array): string {
      try {
        let str = "";
        for (let i = 0; i < uint8array.length; i++) {
          str += String.fromCharCode(uint8array[i]);
        }
        return decodeURIComponent(escape(str));
      } catch (e) {
        // Fallback for partial UTF-8
        let result = "";
        for (let i = 0; i < uint8array.length; i++) {
          result += String.fromCharCode(uint8array[i]);
        }
        return result;
      }
    }
  };
}

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

/** Base64 encode (Figma main thread may not have btoa). */
function base64Encode(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    result += chars[a >> 2];
    result += chars[((a & 3) << 4) | (b >> 4)];
    result += i + 1 < bytes.length ? chars[((b & 15) << 2) | (c >> 6)] : '=';
    result += i + 2 < bytes.length ? chars[c & 63] : '=';
  }
  return result;
}

/** Base64 decode without atob (Figma main thread may not have it). */
function base64DecodeToUint8Array(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  lookup[61] = 0; // '='
  const len = base64.replace(/=+$/, '').length;
  const bufferLength = (len * 3) >> 2;
  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const a = lookup[base64.charCodeAt(i)] ?? 0;
    const b = lookup[base64.charCodeAt(i + 1)] ?? 0;
    const c = i + 2 < base64.length ? (lookup[base64.charCodeAt(i + 2)] ?? 0) : 0;
    const d = i + 3 < base64.length ? (lookup[base64.charCodeAt(i + 3)] ?? 0) : 0;
    bytes[p++] = (a << 2) | (b >> 4);
    if (p < bufferLength) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < bufferLength) bytes[p++] = ((c & 3) << 6) | (d & 63);
  }
  return bytes;
}

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  try {
    switch (msg.type) {
      case 'get-settings': {
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

      case 'list-discovered-tools': {
        const discoveryUrl = msg.discoveryUrl ?? (await figma.clientStorage.getAsync('audion-settings'))?.opalDiscoveryUrl;
        if (!discoveryUrl) {
          figma.ui.postMessage({
            type: 'discovered-tools',
            tools: [],
            error: 'No discovery URL configured. Set Opal Discovery URL in Settings.',
          });
          break;
        }
        try {
          const settings = await figma.clientStorage.getAsync('audion-settings');
          const bearerToken = settings?.authToken;
          const fetchFn: FetchLike = (url, init) =>
            figmaFetch(url, {
              method: init?.method ?? 'GET',
              headers: init?.headers ?? {},
              body: init?.body ?? '',
            });
          const tools = await listDiscoveredTools(discoveryUrl, bearerToken, fetchFn);
          figma.ui.postMessage({ type: 'discovered-tools', tools });
        } catch (error) {
          figma.ui.postMessage({
            type: 'discovered-tools',
            tools: [],
            error: error instanceof Error ? error.message : String(error),
          });
        }
        break;
      }

      case 'call-discovered-tool': {
        const { toolId, body } = msg as { toolId: string; body?: unknown };
        const discoveryUrl = msg.discoveryUrl ?? (await figma.clientStorage.getAsync('audion-settings'))?.opalDiscoveryUrl;
        if (!discoveryUrl || !toolId) {
          figma.ui.postMessage({
            type: 'discovered-tool-result',
            error: 'Missing discovery URL or toolId.',
          });
          break;
        }
        try {
          const settings = await figma.clientStorage.getAsync('audion-settings');
          const bearerToken = settings?.authToken;
          const fetchFn: FetchLike = (url, init) =>
            figmaFetch(url, {
              method: init?.method ?? 'GET',
              headers: init?.headers ?? {},
              body: init?.body ?? '',
            });
          const result = await callDiscoveredTool(discoveryUrl, toolId, {
            bearerToken,
            body,
            fetchFn,
          });
          figma.ui.postMessage({ type: 'discovered-tool-result', result });
        } catch (error) {
          figma.ui.postMessage({
            type: 'discovered-tool-result',
            error: error instanceof Error ? error.message : String(error),
          });
        }
        break;
      }

      case 'get-knowledge': {
        try {
          const raw = await figma.clientStorage.getAsync(STORAGE_KEY_KNOWLEDGE);
          const knowledge = normalizeKnowledge(raw);
          figma.ui.postMessage({
            type: 'knowledge-loaded',
            knowledge,
          });
        } catch (error) {
          figma.ui.postMessage({
            type: 'knowledge-loaded',
            knowledge: { components: [], pages: [], lastUpdated: Date.now() },
          });
        }
        break;
      }

      case 'save-knowledge': {
        try {
          await figma.clientStorage.setAsync(STORAGE_KEY_KNOWLEDGE, msg.knowledge);
          figma.ui.postMessage({
            type: 'knowledge-saved',
          });
        } catch (error) {
          console.error('Failed to save knowledge:', error);
        }
        break;
      }

      case 'scan-components': {
        try {
          const newComponents = scanSelectedComponents();
          if (newComponents.length === 0) {
            figma.notify('Keine Komponenten in der Auswahl gefunden.');
            break;
          }
          
          figma.notify('Scannen abgeschlossen. Nutze KI für Deep Analysis...', { timeout: 1000 });
          
          // Get API Key for enrichment
          const settings = await figma.clientStorage.getAsync('audion-settings');
          const apiKey = settings?.openAiApiKey;
          
          if (apiKey) {
            // Enrich with AI
            for (let i = 0; i < newComponents.length; i++) {
              const comp = newComponents[i];
              try {
                const response = await figmaFetch("https://api.openai.com/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                  },
                  body: JSON.stringify({
                    model: "gpt-4o-mini", // Use mini for fast enrichment
                    messages: [
                      { role: "system", content: KNOWLEDGE_ENRICHMENT_SYSTEM_PROMPT },
                      { role: "user", content: buildEnrichmentPrompt(comp) }
                    ],
                    response_format: { type: "json_object" }
                  })
                });
                
                if (response.ok) {
                  const data = await response.json();
                  const enrichment = JSON.parse(data.choices[0].message.content);
                  comp.tags = enrichment.tags;
                  comp.styleCategory = enrichment.styleCategory;
                  comp.usageNotes = enrichment.usageNotes;
                }
              } catch (e) {
                console.error(`AI Enrichment failed for ${comp.name}:`, e);
              }
            }
          }
          
          // Load existing (ensure pages for extended type)
          const current = normalizeKnowledge(await figma.clientStorage.getAsync(STORAGE_KEY_KNOWLEDGE));
          
          // Merge
          const merged = [...current.components];
          for (const nc of newComponents) {
            const idx = merged.findIndex(c => c.id === nc.id);
            if (idx !== -1) {
              merged[idx] = nc;
            } else {
              merged.push(nc);
            }
          }
          
          const updated: ComponentKnowledgeBase = {
            components: merged,
            pages: current.pages,
            lastUpdated: Date.now()
          };
          
          await figma.clientStorage.setAsync(STORAGE_KEY_KNOWLEDGE, updated);
          figma.notify(`${newComponents.length} Komponente(n) mit KI analysiert.`);
          
          figma.ui.postMessage({
            type: 'knowledge-loaded',
            knowledge: updated,
          });
        } catch (error) {
          console.error('Scanning error:', error);
          figma.notify('Fehler beim Scannen der Komponenten.');
        }
        break;
      }

      case 'scan-page': {
        try {
          const scannedPage = scanSelectedPage();
          if (!scannedPage) {
            figma.notify('Select a single frame or group that represents a full page.');
            break;
          }
          const current = normalizeKnowledge(await figma.clientStorage.getAsync(STORAGE_KEY_KNOWLEDGE));
          const pages = [...(current.pages ?? [])];
          const existingIdx = pages.findIndex(p => p.id === scannedPage.id);
          if (existingIdx >= 0) {
            pages[existingIdx] = scannedPage;
          } else {
            pages.push(scannedPage);
          }
          const updated: ComponentKnowledgeBase = {
            components: current.components,
            pages,
            lastUpdated: Date.now(),
          };
          await figma.clientStorage.setAsync(STORAGE_KEY_KNOWLEDGE, updated);
          figma.notify(`Page "${scannedPage.name}" added to knowledge.`);
          figma.ui.postMessage({ type: 'knowledge-loaded', knowledge: updated });
        } catch (error) {
          console.error('Page scan error:', error);
          figma.notify('Fehler beim Scannen der Seite.');
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

      case 'get-rag-components': {
        const components = getRAGComponentsFromSelection();
        const fileKey = figma.fileKey ?? 'plugin-selection';
        // Debug: log extraction result to plugin console (Plugins → Development → Open console)
        if (components.length > 0) {
          console.log('[RAG] Components loaded:', components.length);
          for (const c of components) {
            if (c.componentType === 'component_set' && (c.variantCount ?? 0) > 0) {
              const propSummary = c.properties
                ? Object.entries(c.properties).map(([k, p]) => `${k}: [${(p.options ?? []).join(', ')}]`).join(', ')
                : '—';
              console.log(`  [SET] ${c.name}: ${c.variantCount} variants, properties: ${propSummary || '—'}`);
              if (c.variants?.length) {
                console.log('  Variant names:', c.variants.slice(0, 8).map((v) => v.name).join(', ') + (c.variants.length > 8 ? ` … +${c.variants.length - 8}` : ''));
              }
            } else {
              console.log(`  [${c.componentType}] ${c.name}`);
            }
          }
        }

        let inferred: { aestheticStyle?: string; commonContexts?: string[]; usageHint?: string } | null = null;
        const settings = await figma.clientStorage.getAsync('audion-settings');
        const ragApiUrl = (settings?.ragApiUrl || URL_CONFIG.RAG_API_BASE || '').replace(/\/$/, '');
        if (components.length > 0 && ragApiUrl) {
          const summary = components.map((c) => ({
            name: c.name,
            componentType: c.componentType,
            variantCount: c.variantCount ?? 0,
            variantNames: (c.variants ?? []).slice(0, 8).map((v) => v.name),
          }));
          let screenshotBase64: string | undefined;
          const sel = figma.currentPage.selection;
          if (sel.length === 1 && 'exportAsync' in sel[0]) {
            try {
              const bytes = await (sel[0] as { exportAsync: (o: { format: 'PNG' }) => Promise<Uint8Array> }).exportAsync({ format: 'PNG' });
              screenshotBase64 = base64Encode(new Uint8Array(bytes));
            } catch (_) {
              /* ignore */
            }
          }
          try {
            const body = JSON.stringify({ components: summary, ...(screenshotBase64 && { screenshot: screenshotBase64 }) });
            // Content-Type text/plain → "simple" request → no CORS preflight (OPTIONS)
            const res = await figmaFetch(ragApiUrl + '/api/v1/infer-component-metadata', {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body,
            });
            if (res.ok) {
              const data = (await res.json()) as { aestheticStyle?: string; commonContexts?: string[]; usageHint?: string };
              inferred = {
                aestheticStyle: data.aestheticStyle,
                commonContexts: data.commonContexts,
                usageHint: data.usageHint,
              };
            }
          } catch (e) {
            console.warn('[RAG] Infer metadata failed:', e);
          }
        }

        figma.ui.postMessage({
          type: 'rag-components-loaded',
          components,
          fileKey,
          ...(inferred && { inferred }),
        });
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
          const imageBytes = await captureSelection(node);
          figma.ui.postMessage({
            type: 'screenshot-captured',
            screenshotBytes: imageBytes,
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

      case 'html-to-figma-capture': {
        const url = typeof (msg as { url?: string }).url === 'string'
          ? (msg as { url: string }).url.trim()
          : '';
        if (!url || !url.startsWith('http')) {
          figma.notify('Ungültige URL');
          figma.ui.postMessage({
            type: 'html-to-figma-error',
            error: 'Ungültige oder fehlende URL (http/https)',
          });
          break;
        }
        const settings = await figma.clientStorage.getAsync('audion-settings');
        const htmlToFigmaImageDebug = Boolean(settings?.htmlToFigmaImageDebug);
        const apiBaseUrl = (settings?.ragApiUrl || URL_CONFIG.RAG_API_BASE || '').replace(/\/$/, '');
        if (!apiBaseUrl) {
          figma.notify('RAG-API-URL nicht konfiguriert');
          figma.ui.postMessage({
            type: 'html-to-figma-error',
            error: 'RAG-API-URL in Einstellungen fehlt',
          });
          break;
        }
        try {
          const res = await withTimeout(
            figmaFetch(
              apiBaseUrl +
                '/api/v1/capture-page' +
                (htmlToFigmaImageDebug ? '?debugImages=1' : ''),
              {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify({ url }),
            }),
            90_000,
            'Capture timeout'
          );
          if (!res.ok) {
            const errBody = await res.text();
            const detail = errBody ? (errBody.slice(0, 200) + (errBody.length > 200 ? '…' : '')) : res.statusText;
            throw new Error(`${res.status}: ${detail}`);
          }
          const data = (await res.json()) as {
            layers?: unknown;
            imageDebug?: Record<string, unknown>;
            meta?: {
              jobId?: string;
              previewUrl?: string;
            };
          };
          const layers = data?.layers;
          if (layers == null) {
            throw new Error('Keine Layer in der Antwort');
          }
          if (data?.imageDebug) {
            console.info('[html-figma:image-debug:backend]', data.imageDebug);
            figma.ui.postMessage({ type: 'html-to-figma-image-debug', stage: 'backend', payload: data.imageDebug });
          }
          await figma.loadFontAsync(defaultFont);
          const baseFrame = figma.currentPage;
          const rootLayers = Array.isArray(layers) ? layers : [layers];
          const collectImageStats = (nodes: unknown[]): { paints: number; withBase64: number; withImageHash: number } => {
            const stats = { paints: 0, withBase64: 0, withImageHash: 0 };
            const walk = (node: unknown) => {
              if (!node || typeof node !== 'object') return;
              const n = node as { fills?: unknown; backgrounds?: unknown; children?: unknown };
              const paintArrays = [n.fills, n.backgrounds];
              for (const arr of paintArrays) {
                if (!Array.isArray(arr)) continue;
                for (const p of arr) {
                  if (!p || typeof p !== 'object') continue;
                  const paint = p as { type?: unknown; base64?: unknown; imageHash?: unknown };
                  if (paint.type === 'IMAGE') {
                    stats.paints++;
                    if (typeof paint.base64 === 'string' && paint.base64.length > 0) stats.withBase64++;
                    if (typeof paint.imageHash === 'string' && paint.imageHash.length > 0) stats.withImageHash++;
                  }
                }
              }
              if (Array.isArray(n.children)) n.children.forEach(walk);
            };
            nodes.forEach(walk);
            return stats;
          };
          const beforeStats = collectImageStats(rootLayers as unknown[]);
          console.info('[html-figma:image-debug:plugin:before-addLayers]', beforeStats);
          figma.ui.postMessage({ type: 'html-to-figma-image-debug', stage: 'plugin-before', payload: beforeStats });
          let frameRoot: SceneNode | null = null;
          await addLayersToFrame(rootLayers as Parameters<typeof addLayersToFrame>[0], baseFrame, ({ node, parent }) => {
            if (!parent) {
              frameRoot = node;
              node.name = 'HTML-to-Figma';
            }
          });
          const afterStats = collectImageStats(rootLayers as unknown[]);
          console.info('[html-figma:image-debug:plugin:after-addLayers]', afterStats);
          figma.ui.postMessage({ type: 'html-to-figma-image-debug', stage: 'plugin-after', payload: afterStats });
          if (frameRoot) {
            figma.currentPage.selection = [frameRoot];
            figma.viewport.scrollAndZoomIntoView([frameRoot]);
          }
          figma.notify('Seite eingefügt');
          figma.ui.postMessage({ type: 'html-to-figma-success' });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          figma.notify(message.slice(0, 60));
          figma.ui.postMessage({
            type: 'html-to-figma-error',
            error: message,
          });
        }
        break;
      }

      case 'prompt-site-to-figma': {
        const prompt =
          typeof (msg as { prompt?: string }).prompt === 'string'
            ? (msg as { prompt: string }).prompt.trim()
            : '';
        const viewportRaw = (msg as { viewport?: string }).viewport;
        const viewport =
          viewportRaw === 'tablet' || viewportRaw === 'mobile' ? viewportRaw : 'desktop';
        const componentLibraryRaw = (msg as { componentLibrary?: string }).componentLibrary;
        const componentLibrary = componentLibraryRaw === 'porsche' ? 'porsche' : 'default';
        const renderModeRaw = (msg as { renderMode?: string }).renderMode;
        const renderMode =
          renderModeRaw === 'experimental' || renderModeRaw === 'free'
            ? renderModeRaw
            : 'production';
        if (!prompt) {
          figma.notify('Prompt fehlt');
          figma.ui.postMessage({
            type: 'prompt-site-to-figma-error',
            error: 'Missing prompt',
          });
          break;
        }
        const settings = await figma.clientStorage.getAsync('audion-settings');
        const apiBaseUrl = (settings?.ragApiUrl || URL_CONFIG.RAG_API_BASE || '').replace(/\/$/, '');
        const pluginSecret =
          typeof settings?.creationPluginApiSecret === 'string'
            ? settings.creationPluginApiSecret.trim()
            : '';
        if (!apiBaseUrl) {
          figma.notify('RAG-API-URL nicht konfiguriert');
          figma.ui.postMessage({
            type: 'prompt-site-to-figma-error',
            error: 'RAG-API-URL in Einstellungen fehlt',
          });
          break;
        }
        if (!pluginSecret) {
          figma.notify('CREATION Plugin Secret in SETUP eintragen');
          figma.ui.postMessage({
            type: 'prompt-site-to-figma-error',
            error: 'CREATION plugin secret missing in settings',
          });
          break;
        }
        try {
          const res = await withTimeout(
            figmaFetch(apiBaseUrl + CREATION_GENERATE_SITE_TO_LAYERS_PATH, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${pluginSecret}`,
              },
              body: JSON.stringify({ prompt, viewport, componentLibrary, renderMode }),
            }),
            120_000,
            'Generate site timeout'
          );
          if (!res.ok) {
            const errBody = await res.text();
            const detail = errBody
              ? errBody.slice(0, 400) + (errBody.length > 400 ? '…' : '')
              : res.statusText;
            throw new Error(`${res.status}: ${detail}`);
          }
          const data = (await res.json()) as {
            layers?: unknown;
            imageDebug?: Record<string, unknown>;
            meta?: {
              jobId?: string;
              previewUrl?: string;
              componentLibrary?: string;
              renderMode?: string;
              adapterUsed?: string;
              fallbackCount?: number;
              fidelityWarnings?: Array<{ message?: string }>;
            };
          };
          const layers = data?.layers;
          if (layers == null) {
            throw new Error('Keine Layer in der Antwort');
          }
          if (data?.imageDebug) {
            console.info('[prompt-site:image-debug:backend]', data.imageDebug);
            figma.ui.postMessage({
              type: 'html-to-figma-image-debug',
              stage: 'backend',
              payload: data.imageDebug,
            });
          }
          await figma.loadFontAsync(defaultFont);
          const baseFrame = figma.currentPage;
          const rootLayers = Array.isArray(layers) ? layers : [layers];
          const collectImageStats = (nodes: unknown[]): { paints: number; withBase64: number; withImageHash: number } => {
            const stats = { paints: 0, withBase64: 0, withImageHash: 0 };
            const walk = (node: unknown) => {
              if (!node || typeof node !== 'object') return;
              const n = node as { fills?: unknown; backgrounds?: unknown; children?: unknown };
              const paintArrays = [n.fills, n.backgrounds];
              for (const arr of paintArrays) {
                if (!Array.isArray(arr)) continue;
                for (const p of arr) {
                  if (!p || typeof p !== 'object') continue;
                  const paint = p as { type?: unknown; base64?: unknown; imageHash?: unknown };
                  if (paint.type === 'IMAGE') {
                    stats.paints++;
                    if (typeof paint.base64 === 'string' && paint.base64.length > 0) stats.withBase64++;
                    if (typeof paint.imageHash === 'string' && paint.imageHash.length > 0) stats.withImageHash++;
                  }
                }
              }
              if (Array.isArray(n.children)) n.children.forEach(walk);
            };
            nodes.forEach(walk);
            return stats;
          };
          const beforeStats = collectImageStats(rootLayers as unknown[]);
          figma.ui.postMessage({
            type: 'html-to-figma-image-debug',
            stage: 'plugin-before',
            payload: beforeStats,
          });
          let frameRoot: SceneNode | null = null;
          await addLayersToFrame(rootLayers as Parameters<typeof addLayersToFrame>[0], baseFrame, ({ node, parent }) => {
            if (!parent) {
              frameRoot = node;
              node.name = 'Prompt → Site';
            }
          });
          const afterStats = collectImageStats(rootLayers as unknown[]);
          figma.ui.postMessage({
            type: 'html-to-figma-image-debug',
            stage: 'plugin-after',
            payload: afterStats,
          });
          if (frameRoot) {
            figma.currentPage.selection = [frameRoot];
            figma.viewport.scrollAndZoomIntoView([frameRoot]);
          }
          figma.notify('Landingpage eingefügt');
          const fallbackPreviewUrl =
            typeof data?.meta?.jobId === 'string'
              ? `${apiBaseUrl}${CREATION_GENERATE_SITE_PREVIEW_PATH}/${encodeURIComponent(data.meta.jobId)}`
              : undefined;
          figma.ui.postMessage({
            type: 'prompt-site-to-figma-success',
            previewUrl:
              typeof data?.meta?.previewUrl === 'string'
                ? data.meta.previewUrl
                : fallbackPreviewUrl,
            renderMeta: data?.meta,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          figma.notify(message.slice(0, 60));
          figma.ui.postMessage({
            type: 'prompt-site-to-figma-error',
            error: message,
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

      case 'visualize-journey': {
        const { journey } = msg;
        const phases = journey.phases || [];
        
        // Wait for all needed fonts at once
        await Promise.all([
          figma.loadFontAsync({ family: 'Inter', style: 'Regular' }),
          figma.loadFontAsync({ family: 'Inter', style: 'Bold' }),
        ]);

        // Starting position
        let startX = 0;
        let startY = 0;
        
        // Find center of current view
        const center = figma.viewport.center;
        startX = center.x - (phases.length * 300) / 2;
        startY = center.y;

        const nodes: SceneNode[] = [];

        for (let i = 0; i < phases.length; i++) {
          const phase = phases[i];
          
          // Create Frame
          const frame = figma.createFrame();
          frame.name = `Phase: ${phase.name}`;
          frame.resize(250, 450);
          frame.x = startX + i * 300;
          frame.y = startY;
          
          // Style Frame
          frame.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.97, b: 0.95 } }]; // Offwhite
          frame.cornerRadius = 16;
          frame.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
          
          // Add Title
          const title = figma.createText();
          title.fontName = { family: 'Inter', style: 'Bold' };
          title.characters = (phase.name || '').toUpperCase();
          title.fontSize = 14;
          title.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
          title.x = 20;
          title.y = 20;
          frame.appendChild(title);

          // Add Elements
          let elementY = 60;
          for (const element of (phase.elements || [])) {
            // Visualize element as a small card/wireframe block
            const rect = figma.createRectangle();
            rect.resize(210, 40);
            rect.x = 20;
            rect.y = elementY;
            rect.cornerRadius = 8;
            rect.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
            rect.strokes = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
            frame.appendChild(rect);

            const elText = figma.createText();
            elText.fontName = { family: 'Inter', style: 'Regular' };
            const content = element.content || '';
            elText.characters = content.length > 40 ? content.substring(0, 37) + '...' : content;
            elText.fontSize = 10;
            elText.x = 30;
            elText.y = elementY + 15;
            frame.appendChild(elText);

            elementY += 50;
          }

          nodes.push(frame);
        }

        figma.currentPage.selection = nodes;
        figma.viewport.scrollAndZoomIntoView(nodes);
        
        figma.ui.postMessage({
          type: 'journey-visualized',
        });
        break;
      }

      case 'generate-wireframe': {
        const { prompt, viewport, model, apiKey } = msg;
        console.log("[Wireframe] generate-wireframe start", { viewport, promptLen: prompt?.length });

        figma.ui.postMessage({ type: 'generation-progress', message: 'Starte…' });

        if (!apiKey || typeof apiKey !== 'string') {
          console.error("[Wireframe] Missing API key");
          figma.notify('OpenAI API-Key fehlt. Bitte in Einstellungen eintragen.');
          figma.ui.postMessage({ type: 'wireframe-error', error: 'Missing API key' });
          break;
        }

        try {
          figma.notify('Wireframe: Starte…');
          const knowledge = normalizeKnowledge(await figma.clientStorage.getAsync(STORAGE_KEY_KNOWLEDGE));
          console.log("[Wireframe] knowledge loaded", { components: knowledge.components?.length ?? 0, pages: knowledge.pages?.length ?? 0 });
          const selection = figma.currentPage.selection;
          const contextNode: (BaseNode & ChildrenMixin) | null = selection.length > 0 ? selection[0] as BaseNode & ChildrenMixin : null;

          const reportProgress = (message: string) => {
            figma.ui.postMessage({ type: 'generation-progress', message });
          };

          console.log("[Wireframe] TOOLS MODE: start");
          const nodeMap = new Map<string, SceneNode>();
          const stageWidth = viewport === 'mobile' ? 390 : 1440;
          const stageHeight = 1024;
          const variableMap = await getOrCreateWireframeVariables();
          const stageResult = createStage(
            { nodeMap },
            { width: stageWidth, height: stageHeight, name: 'Wireframe', id: 'stage' }
          );
          if (!stageResult.success) {
            figma.notify(`Bühne: ${stageResult.error.substring(0, 50)}…`, { timeout: 5000 });
            figma.ui.postMessage({ type: 'wireframe-error', error: stageResult.error });
            break;
          }
          reportProgress('Agent (Tools) startet…');
          try {
            const result = await runWireframeToolAgent({
              fetch: figmaFetch,
              apiKey,
              model,
              userPrompt: prompt,
              viewport,
              stageWidth,
              stageHeight,
              nodeMap,
              variableMap: variableMap ?? undefined,
              variablesApi: typeof figma !== 'undefined' ? (figma.variables as { setBoundVariableForPaint: (paint: unknown, field: string, variable: unknown) => unknown }) : undefined,
              maxSteps: 15,
              requestTimeoutMs: 90000,
              onProgress: reportProgress,
            });
            if (result.success) {
              figma.notify('Wireframe (Tools) fertig');
              const stageNode = nodeMap.get('stage');
              if (stageNode) {
                try {
                  figma.viewport.scrollAndZoomIntoView([stageNode]);
                } catch (_) {}
              }
              figma.ui.postMessage({ type: 'wireframe-generated' });
            } else {
              const err = result.error;
              figma.notify(`Fehler: ${err.substring(0, 50)}…`, { timeout: 5000 });
              figma.ui.postMessage({ type: 'wireframe-error', error: err });
            }
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            figma.notify(`Agent Fehler: ${errMsg.substring(0, 50)}…`, { timeout: 5000 });
            figma.ui.postMessage({ type: 'wireframe-error', error: errMsg });
          }
        } catch (error: unknown) {
          const isAbort = typeof error === 'object' && error != null && (error as Error).name === 'AbortError';
          const errMsg = isAbort
            ? 'OpenAI-Anfrage Timeout (90s). Bitte erneut versuchen oder kürzeren Prompt nutzen.'
            : (error instanceof Error ? error.message : String(error));
          console.error("[Wireframe] generate-wireframe catch:", errMsg, error);
          figma.notify(`Fehler: ${errMsg.substring(0, 60)}${errMsg.length > 60 ? '…' : ''}`);
          figma.ui.postMessage({
            type: 'wireframe-error',
            error: errMsg,
          });
        }
        break;
      }

      case 'dsl-render': {
        const { dslJson, tokenOverrides } = msg as {
          dslJson: string;
          tokenOverrides?: unknown;
        };
        try {
          const dsl = parseDSL(dslJson);
          const projectTokens = await figma.clientStorage.getAsync('audion-dsl-tokens');
          const tokens = resolveTokens(dsl.tokens ?? null, projectTokens ?? undefined);
          await preloadFontsForDSL(dsl, tokens);
          const width = dsl.width ?? 1440;
          const root = figma.createFrame();
          root.name = dsl.page ?? 'Generated Design';
          root.layoutMode = 'VERTICAL';
          root.primaryAxisSizingMode = 'AUTO';
          root.counterAxisSizingMode = 'FIXED';
          root.resize(width, 0);
          root.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 }];

          const ctx: RenderContext = {
            tokens,
            parentWidth: width,
            fontCache: new Set(),
            renderChildren: (children, parent, overrides) =>
              renderChildren(children, parent, ctx, overrides),
          };
          await renderChildren(dsl.children, root, ctx);

          const viewport = figma.viewport.center;
          root.x = viewport.x - root.width / 2;
          root.y = viewport.y - root.height / 2;
          figma.currentPage.appendChild(root);
          figma.viewport.scrollAndZoomIntoView([root]);

          figma.ui.postMessage({ type: 'dsl-render-success' });
          figma.notify('DSL Design gerendert');
        } catch (err) {
          const message =
            err instanceof DSLParseError || err instanceof DSLValidationError
              ? err.message
              : err instanceof Error
                ? err.message
                : String(err);
          figma.notify(`DSL Fehler: ${message.substring(0, 50)}…`, { timeout: 5000 });
          figma.ui.postMessage({ type: 'dsl-render-error', error: message });
        }
        break;
      }

      case 'read-selection-dsl': {
        const selection = figma.currentPage.selection;
        if (selection.length === 0) {
          figma.ui.postMessage({ type: 'selection-empty-dsl' });
          break;
        }
        try {
          const projectTokens = await figma.clientStorage.getAsync('audion-dsl-tokens');
          const tokens = resolveTokens(null, projectTokens ?? undefined);
          const nodes = selection.length === 1
            ? [figmaNodeToDSL(selection[0], tokens)]
            : selection
                .map((n) => figmaNodeToDSL(n, tokens))
                .filter((n): n is NonNullable<typeof n> => n != null);
          if (nodes.length === 0) {
            figma.ui.postMessage({
              type: 'selection-dsl-error',
              error: 'Selection could not be converted to DSL',
            });
          } else if (nodes.length === 1) {
            figma.ui.postMessage({ type: 'selection-dsl', dsl: nodes[0] });
          } else {
            const root = {
              type: 'frame',
              name: 'Selection',
              layout: 'vertical',
              width: (selection[0] as SceneNode).absoluteBoundingBox?.width ?? 1440,
              children: nodes,
            };
            figma.ui.postMessage({ type: 'selection-dsl', dsl: root });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          figma.ui.postMessage({ type: 'selection-dsl-error', error: message });
        }
        break;
      }

      case 'get-file-key': {
        figma.ui.postMessage({ type: 'file-key', fileKey: figma.fileKey ?? null });
        break;
      }

      case 'rag-compose-render': {
        const { composition, resolvedKeys, resolvedTypes } = msg as {
          composition: import('./api/rag-compose-client').CompositionJSON;
          resolvedKeys: Record<string, string>;
          resolvedTypes?: Record<string, 'component' | 'component_set'>;
        };
        try {
          const root = await renderComposition(composition, resolvedKeys ?? {}, resolvedTypes ?? {});
          await figma.clientStorage.setAsync('audion-rag-composed-root-id', root.id);
          figma.ui.postMessage({ type: 'rag-compose-render-success' });
          figma.notify('RAG Design gerendert');
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          figma.notify(`RAG Fehler: ${message.substring(0, 50)}…`, { timeout: 5000 });
          figma.ui.postMessage({ type: 'rag-compose-render-error', error: message });
        }
        break;
      }

      case 'rag-export-screenshot': {
        const rootId = await figma.clientStorage.getAsync('audion-rag-composed-root-id');
        if (!rootId || typeof rootId !== 'string') {
          figma.ui.postMessage({ type: 'rag-screenshot-error', error: 'No composed design to export' });
          break;
        }
        const node = figma.getNodeById(rootId) as SceneNode | null;
        if (!node) {
          figma.ui.postMessage({ type: 'rag-screenshot-error', error: 'Composed design not found' });
          break;
        }
        try {
          const bytes = await (node as { exportAsync: (opts: { format: 'PNG' }) => Promise<Uint8Array> }).exportAsync({ format: 'PNG' });
          const b64 = base64Encode(new Uint8Array(bytes));
          figma.ui.postMessage({ type: 'rag-screenshot-exported', base64: b64 });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          figma.ui.postMessage({ type: 'rag-screenshot-error', error: message });
        }
        break;
      }

      case 'rag-refine': {
        const settings = await figma.clientStorage.getAsync('audion-settings');
        const apiKey = settings?.openAiApiKey;
        const rootId = await figma.clientStorage.getAsync('audion-rag-composed-root-id');
        if (!apiKey || typeof apiKey !== 'string') {
          figma.notify('OpenAI API-Key fehlt. Bitte in Einstellungen eintragen.');
          figma.ui.postMessage({ type: 'rag-refine-error', error: 'Missing OpenAI API key' });
          break;
        }
        if (!rootId || typeof rootId !== 'string') {
          figma.notify('Kein RAG-Design vorhanden. Zuerst Compose ausführen.');
          figma.ui.postMessage({ type: 'rag-refine-error', error: 'No composed design to refine' });
          break;
        }
        const node = figma.getNodeById(rootId);
        if (!node) {
          figma.notify('Composition wurde gelöscht oder nicht gefunden.');
          figma.ui.postMessage({ type: 'rag-refine-error', error: 'Composed design not found' });
          break;
        }
        try {
          const reportProgress = (message: string) => {
            figma.ui.postMessage({ type: 'rag-refine-progress', message });
          };
          const reportDebug = (tool: string, args: Record<string, unknown>, res: unknown) => {
            figma.ui.postMessage({ type: 'rag-refine-debug', tool, args, result: res });
          };
          const result = await runRagRefinementAgent({
            fetch: (url, opts) =>
              fetch(url, {
                method: opts.method,
                headers: opts.headers,
                body: opts.body,
              }),
            apiKey,
            model: 'gpt-4o-mini',
            rootId,
            maxSteps: 10,
            requestTimeoutMs: 30000,
            onProgress: reportProgress,
            onDebug: reportDebug,
          });
          if (result.success) {
            const root = figma.getNodeById(rootId);
            if (root && 'layoutMode' in root) {
              figma.currentPage.selection = [root as SceneNode];
              figma.viewport.scrollAndZoomIntoView([root as SceneNode]);
            }
            figma.notify('Layout verfeinert');
            figma.ui.postMessage({ type: 'rag-refine-success' });
          } else {
            figma.notify(`Refinement: ${result.error?.slice(0, 50)}…`, { timeout: 5000 });
            figma.ui.postMessage({ type: 'rag-refine-error', error: result.error });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          figma.notify(`Refinement Fehler: ${message.slice(0, 50)}…`, { timeout: 5000 });
          figma.ui.postMessage({ type: 'rag-refine-error', error: message });
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

