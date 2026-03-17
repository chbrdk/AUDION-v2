import {
  getSelectionMetadata,
  validateSelection,
  getSelectedNodes,
} from './services/selection-service';
import { captureSelection } from './services/screenshot-service';
import {
  generateConversationId,
  loadConversation,
  createConversation,
  addMessageToConversation,
} from './services/conversation-service';
import type { SelectionMetadata } from './types';
import { PLANNER_AGENT_SYSTEM_PROMPT, buildPlannerPrompt } from './agent/planner-agent';
import { scanSelectedComponents } from './agent/scanner';
import { scanSelectedPage } from './agent/page-scanner';
import { KNOWLEDGE_ENRICHMENT_SYSTEM_PROMPT, buildEnrichmentPrompt } from './agent/enrichment-agent';
import { FIGMA_API_EXPERT_SYSTEM_PROMPT, buildApiExpertPrompt, FIGMA_COMMAND_JSON_SCHEMA } from './agent/figma-api-agent';
import { runCommands } from './agent/command-interpreter';
import { createFrame } from './agent/figma-atoms';
import { createButton, createSection, addText, createStage } from './agent/figma-molecules';
import { executeTool } from './agent/execute-tool';
import { runWireframeToolAgent } from './agent/wireframe-tool-agent';
import { DESIGN_SPEC_AGENT_SYSTEM_PROMPT, buildDesignSpecPrompt } from './agent/design-spec-agent';
import { CONCEPT_AGENT_SYSTEM_PROMPT, buildConceptPrompt } from './agent/concept-agent';
import type { ComponentKnowledgeBase } from './types';
import type { FigmaCommand } from './agent/figma-command-schema';
import { URL_CONFIG } from './config/urls';
import {
  listDiscoveredTools,
  callDiscoveredTool,
  type FetchLike,
} from './api/discovery-client';

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

// --- RESEARCH TOOLING ---
async function performWebSearch(query: string, apiKey: string): Promise<string> {
  console.log(`Researching: ${query}`);
  try {
    const researchRequest = {
      model: "gpt-4o", // Strong model for technical research
      messages: [
        { 
          role: "system", 
          content: "Du bist ein Figma API Researcher. Deine Aufgabe ist es, präzise technische Informationen zur Figma Plugin API zu liefern. Suche in deinem Wissen nach den aktuellsten Mustern (Stand 2024+) für das angegebene Problem. Antworte kurz und technisch präzise." 
        },
        { role: "user", content: `Löse folgendes technisches Problem in der Figma API oder erkläre die korrekte Syntax: ${query}` }
      ]
    };

    const res = await figmaFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(researchRequest)
    });

    if (!res.ok) return "Keine Research-Ergebnisse verfügbar.";
    const completion = await res.json();
    return completion.choices[0]?.message?.content || "Keine Ergebnisse.";
  } catch (e) {
    return `Research fehlgeschlagen: ${e}`;
  }
}

/**
 * Call Figma Executor (no tools). OpenAI rejects requests that use both tools and response_format (400).
 * Research is done separately and passed as prompt text when retrying after errors.
 */
async function callFigmaExecutor(messages: any[], model: string, apiKey: string): Promise<{ content: string | null }> {
  console.log("[Wireframe] callFigmaExecutor: request start");
  const res = await figmaFetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model,
      messages: messages,
      response_format: { type: "json_schema", json_schema: FIGMA_COMMAND_JSON_SCHEMA },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[Wireframe] callFigmaExecutor: API error", res.status, errText);
    throw new Error(`API Expert Service Error: ${res.status} - ${errText}`);
  }
  const completion = await res.json();
  const message = completion.choices[0]?.message;
  let content: string | null = null;
  if (message?.content != null) {
    if (typeof message.content === 'string') {
      content = message.content;
    } else if (Array.isArray(message.content)) {
      const part = message.content.find((p: any) => p?.type === 'output' && typeof p?.text === 'string');
      if (part?.text) content = part.text;
      else {
        const first = message.content.find((p: any) => typeof (p?.text ?? p?.content) === 'string');
        content = first?.text ?? first?.content ?? null;
      }
    }
  }
  console.log("[Wireframe] callFigmaExecutor: response", content != null ? `content length ${content.length}` : "content null");
  return { content };
}

const STORAGE_KEY_KNOWLEDGE = 'audion-knowledge-base';

const RETRIEVAL_THRESHOLD = 15;

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

async function retrieveRelevantIds(
  knowledge: ComponentKnowledgeBase,
  userPrompt: string,
  apiKey: string
): Promise<{ componentIds: string[]; pageIds: string[] }> {
  const comps = knowledge.components ?? [];
  const pages = knowledge.pages ?? [];
  const total = comps.length + pages.length;
  if (total <= RETRIEVAL_THRESHOLD) {
    const ids = { componentIds: comps.map((c: { id: string }) => c.id), pageIds: pages.map((p: { id: string }) => p.id) };
    console.log("[Wireframe] retrieveRelevantIds: use all (total <= threshold)", total, ids.componentIds.length, ids.pageIds.length);
    return ids;
  }
  console.log("[Wireframe] retrieveRelevantIds: calling API (total > threshold)", total);
  const compLines = comps.map((c: any) =>
    [c.id, c.name, (c.tags || []).join(','), (c.description || '').slice(0, 80)].join('\t')
  );
  const pageLines = pages.map((p: any) =>
    [p.id, p.name, p.pageType || 'generic', p.blueprintSummary || ''].join('\t')
  );
  const indexText = 'COMPONENTS:\n' + compLines.join('\n') + '\n\nPAGES:\n' + pageLines.join('\n');
  try {
    const res = await figmaFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a retrieval helper. Given the user\'s wireframe description and the index below, output JSON only: { "componentIds": string[], "pageIds": string[] } with the IDs of components and pages relevant to the request. Use only IDs that appear in the index. If none relevant, return empty arrays.',
          },
          { role: 'user', content: `User request: ${userPrompt}\n\nIndex:\n${indexText}` },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1024,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response');
    const parsed = JSON.parse(text);
    const componentIds = Array.isArray(parsed.componentIds) ? parsed.componentIds : comps.map((c: any) => c.id);
    const pageIds = Array.isArray(parsed.pageIds) ? parsed.pageIds : pages.map((p: any) => p.id);
    console.log("[Wireframe] retrieveRelevantIds: API returned", componentIds.length, pageIds.length);
    return { componentIds, pageIds };
  } catch (e) {
    console.warn("[Wireframe] retrieveRelevantIds: API failed, use all", e);
    return {
      componentIds: comps.map((c: any) => c.id),
      pageIds: pages.map((p: any) => p.id),
    };
  }
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

/**
 * Helper to safely parse AI JSON responses, handling markdown wrappers.
 */
function parseAIResponse(content: string): any {
  if (!content) return null;
  let cleanStr = content.trim();
  
  // Strip common markdown wrappers
  if (cleanStr.startsWith('```json')) {
    cleanStr = cleanStr.substring(7);
    if (cleanStr.endsWith('```')) cleanStr = cleanStr.substring(0, cleanStr.length - 3);
  } else if (cleanStr.startsWith('```')) {
    cleanStr = cleanStr.substring(3);
    if (cleanStr.endsWith('```')) cleanStr = cleanStr.substring(0, cleanStr.length - 3);
  }
  
  cleanStr = cleanStr.trim();
  try {
    return JSON.parse(cleanStr);
  } catch (e) {
    console.error("JSON Parse Error. Raw content:", content);
    return null;
  }
}

/**
 * Extract design spec { root } from a Chat Completions message.
 * Handles: content (string), content (array of parts), json_output / output fields.
 */
function getDesignSpecFromMessage(message: { content?: string | unknown[]; json_output?: unknown; output?: unknown }): { root: unknown } | null {
  if (!message) return null;
  // Direct object (e.g. json_output / output from structured response)
  const obj = (message as any).json_output ?? (message as any).output;
  if (obj && typeof obj === "object" && (obj as any).root != null) return { root: (obj as any).root };
  // content as string
  const raw = message.content;
  if (typeof raw === "string") {
    const parsed = parseAIResponse(raw);
    return parsed && parsed.root != null ? { root: parsed.root } : null;
  }
  // content as array of parts (e.g. [{ type: "text", text: "..." }])
  if (Array.isArray(raw)) {
    for (const part of raw) {
      if (part && typeof part === "object" && "text" in part && typeof (part as any).text === "string") {
        const parsed = parseAIResponse((part as any).text);
        if (parsed && parsed.root != null) return { root: parsed.root };
      }
      if (part && typeof part === "object" && "content" in part && typeof (part as any).content === "string") {
        const parsed = parseAIResponse((part as any).content);
        if (parsed && parsed.root != null) return { root: parsed.root };
      }
    }
  }
  return null;
}

/** Strip unsupported fields (hover, overlay, aspectRatio) and normalize placeholder width/height to numbers for Figma Executor. */
function sanitizeDesignSpecForExecutor(spec: { root: unknown } | object | string): object | string {
  if (typeof spec === "string") return spec;
  const root = (spec as { root?: unknown }).root;
  if (root == null || typeof root !== "object") return spec as object;
  const DEFAULT_PLACEHOLDER_SIZE = 400;
  function visit(node: any): any {
    if (node == null) return node;
    if (Array.isArray(node)) return node.map(visit);
    if (typeof node !== "object") return node;
    const { hover, overlay, aspectRatio, width, height, children, ...rest } = node;
    let w = width;
    let h = height;
    if (node.type === "placeholder") {
      if (typeof width === "string" && (width === "100%" || width.includes("%"))) w = DEFAULT_PLACEHOLDER_SIZE;
      if (typeof height !== "number") h = typeof height === "number" ? height : 240;
    }
    const out: any = { ...rest };
    if (w !== undefined) out.width = typeof w === "number" ? w : DEFAULT_PLACEHOLDER_SIZE;
    if (h !== undefined) out.height = typeof h === "number" ? h : 240;
    if (children && Array.isArray(children)) out.children = children.map(visit);
    return out;
  }
  return { root: visit(root) };
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
        const { prompt, viewport, model, apiKey, mode } = msg;
        console.log("[Wireframe] generate-wireframe start", { mode, viewport, promptLen: prompt?.length });

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
          let contextNode: (BaseNode & ChildrenMixin) | null = selection.length > 0 ? selection[0] as BaseNode & ChildrenMixin : null;
          const contextMetadata = contextNode ? getSelectionMetadata() : null;

          const reportProgress = (message: string) => {
            figma.ui.postMessage({ type: 'generation-progress', message });
          };

          if (mode === 'tools') {
            console.log("[Wireframe] TOOLS MODE: start");
            const nodeMap = new Map<string, SceneNode>();
            const stageWidth = viewport === 'mobile' ? 390 : 1440;
            const stageHeight = 1024;
            const stageResult = createStage(
              { nodeMap },
              { width: stageWidth, height: stageHeight, name: 'Wireframe', id: 'stage' }
            );
            if (!stageResult.success) {
              figma.notify(`Bühne: ${stageResult.error.substring(0, 50)}…`, { timeout: 5000 });
              figma.ui.postMessage({ type: 'wireframe-error', error: stageResult.error });
              return;
            }
            reportProgress('Agent (Tools) startet…');
            try {
              const result = await runWireframeToolAgent({
                fetch: figmaFetch,
                apiKey,
                model,
                userPrompt: prompt,
                viewport,
                nodeMap,
                maxSteps: 15,
                requestTimeoutMs: 60000,
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
            return;
          }

          reportProgress('Wähle relevante Komponenten…');
          const { componentIds, pageIds } = await retrieveRelevantIds(knowledge, prompt, apiKey);
          console.log("[Wireframe] retrieveRelevantIds done", { componentIds: componentIds?.length ?? 0, pageIds: pageIds?.length ?? 0 });
          reportProgress('Rufe Planner auf…');

          const compSet = new Set(componentIds);
          const pageSet = new Set(pageIds);
          let knowledgeStr = '';
          const selectedComps = (knowledge.components ?? []).filter((c: any) => compSet.has(c.id));
          for (const comp of selectedComps) {
            knowledgeStr += `\n--- \n${comp.documentation}`;
            if (comp.visualBlueprint) {
              knowledgeStr += `Visual Construction Blueprint:\n${comp.visualBlueprint}\n`;
            }
          }

          let pagesStr = '';
          const selectedPages = (knowledge.pages ?? []).filter((p: any) => pageSet.has(p.id));
          for (const p of selectedPages) {
            pagesStr += `\n[${p.name}] (${p.pageType ?? 'generic'}): ${p.blueprintSummary}\n`;
            if (p.structure?.length) {
              pagesStr += '  Sections: ' + p.structure.map((s: any) => s.name).join(' → ') + '\n';
              if (p.componentRefs?.length) pagesStr += '  Components: ' + p.componentRefs.join(', ') + '\n';
            }
          }

          if (mode === 'fast') {
            console.log("[Wireframe] FAST MODE: start");
            reportProgress("Generiere Befehle...");
            const fastPrompt = buildApiExpertPrompt(
              `Einfaches Wireframe: ${prompt}. Viewport: ${viewport}. Erstelle eine kurze Liste von Figma-Befehlen (createFrame, createText, appendChild, loadFont).`
            );
            console.log("[Wireframe] FAST MODE: calling OpenAI chat/completions...");
            reportProgress("OpenAI API wird aufgerufen (max. 90s)…");
            const apiRes = await withTimeout(
              figmaFetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
                body: JSON.stringify({
                  model: model,
                  messages: [
                    { role: "system", content: FIGMA_API_EXPERT_SYSTEM_PROMPT },
                    { role: "user", content: fastPrompt },
                  ],
                  response_format: { type: "json_schema", json_schema: FIGMA_COMMAND_JSON_SCHEMA },
                }),
              }),
              90000,
              "OpenAI-Anfrage Timeout (90s)"
            );
            console.log("[Wireframe] FAST MODE: API status", apiRes.status);
            if (!apiRes.ok) throw new Error(`OpenAI Error: ${apiRes.status} - ${await apiRes.text()}`);
            const completion = await apiRes.json();
            const rawContent = completion.choices[0]?.message?.content;
            const rawType = rawContent == null ? 'null' : Array.isArray(rawContent) ? 'array' : typeof rawContent;
            console.log("[Wireframe] FAST MODE: raw content type", rawType, "length", typeof rawContent === 'string' ? rawContent.length : Array.isArray(rawContent) ? rawContent.length : '-');
            let contentStr: string | null = null;
            if (typeof rawContent === 'string') contentStr = rawContent;
            else if (Array.isArray(rawContent)) {
              const part = rawContent.find((p: any) => typeof (p?.text ?? p?.content) === 'string');
              contentStr = (part && (part.text ?? part.content)) ?? null;
            }
            const content = contentStr ? parseAIResponse(contentStr) : null;
            console.log("[Wireframe] FAST MODE: parsed content", content ? { hasCommands: Array.isArray(content.commands), commandsLen: content.commands?.length, rootId: content.rootId } : "null");
            if (content && Array.isArray(content.commands) && content.rootId) {
              if (!contextNode) {
                const page = figma.createFrame();
                page.name = "Wireframe Page";
                page.resize(viewport === 'mobile' ? 390 : 1440, 1024);
                page.layoutMode = "VERTICAL";
                page.primaryAxisSizingMode = "AUTO";
                figma.currentPage.appendChild(page);
                contextNode = page;
              }
              console.log("[Wireframe] FAST MODE: runCommands start", { commands: content.commands.length, rootId: content.rootId });
              figma.notify(`Führe ${content.commands.length} Befehle aus…`);
              try {
                const result = await runCommands(content.commands as FigmaCommand[], content.rootId, contextNode);
                console.log("[Wireframe] FAST MODE: runCommands result", result.success ? { nodes: result.nodes?.length } : { error: (result as any).error, failedCommandIndex: (result as any).failedCommandIndex });
                if (result.success && result.nodes.length > 0) {
                  const validNodes = result.nodes.filter((n) => n.parent !== null);
                  if (validNodes.length > 0) {
                    try {
                      figma.currentPage.selection = validNodes;
                      figma.viewport.scrollAndZoomIntoView(validNodes);
                    } catch (e) {
                      console.warn("Could not set selection after wireframe:", e);
                    }
                  }
                } else if (!result.success) {
                  const errMsg = result.error || 'Unbekannter Fehler';
                  console.error('[Wireframe] Befehle fehlgeschlagen:', errMsg, result);
                  figma.notify(`Befehle fehlgeschlagen: ${errMsg.substring(0, 60)}…`, { timeout: 6000 });
                  figma.ui.postMessage({ type: 'wireframe-error', error: errMsg });
                }
              } catch (runErr: any) {
                const runMsg = runErr?.message ?? String(runErr);
                console.error("[Wireframe] Fast mode runCommands threw:", runMsg, runErr);
                figma.notify(`Befehle Fehler: ${runMsg.substring(0, 60)}…`, { timeout: 6000 });
                figma.ui.postMessage({ type: 'wireframe-error', error: runMsg });
              }
            } else {
              if (!content) console.error("[Wireframe] FAST MODE: no content from API", rawContent != null ? "content was not string" : "content null");
              else if (!Array.isArray(content.commands) || !content.rootId) console.error("[Wireframe] FAST MODE: content missing commands or rootId", { hasCommands: Array.isArray(content?.commands), rootId: content?.rootId });
              const noCmdMsg = content ? 'Antwort ohne Befehle/rootId' : 'Keine Befehle von API';
              figma.notify(noCmdMsg, { timeout: 5000 });
              figma.ui.postMessage({ type: 'wireframe-error', error: noCmdMsg });
            }
            console.log("[Wireframe] FAST MODE: done, posting wireframe-generated");
            figma.ui.postMessage({ type: 'wireframe-generated' });
            return;
          }

          // --- STYLED: Planner (non-streaming, strict schema) → Design Spec → Figma Executor → Interpreter ---
          console.log("[Wireframe] STYLED MODE: start");

          if (!contextNode) {
            const page = figma.createFrame();
            page.name = "Wireframe Page";
            page.resize(viewport === 'mobile' ? 390 : 1440, 1024);
            page.layoutMode = "VERTICAL";
            page.primaryAxisSizingMode = "AUTO";
            figma.currentPage.appendChild(page);
            contextNode = page;
          }

          const allNewNodes: SceneNode[] = [];
          reportProgress("Director: Konzept & Sektionen...");
          console.log("[Wireframe] STYLED: calling Director (Planner)...");

          const plannerResponse = await withTimeout(
            figmaFetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
              body: JSON.stringify({
                model: model,
                messages: [
                  { role: "system", content: PLANNER_AGENT_SYSTEM_PROMPT },
                  { role: "user", content: buildPlannerPrompt(prompt, viewport, contextMetadata, knowledgeStr, pagesStr) },
                ],
                response_format: { type: "json_object" },
              }),
            }),
            90000,
            "Director Timeout (90s)"
          );

          if (!plannerResponse.ok) {
            const errText = await plannerResponse.text();
            console.error("[Wireframe] STYLED: Planner API error", plannerResponse.status, errText);
            figma.notify(`Planner-Fehler: ${plannerResponse.status}`);
            throw new Error(`Planner API Error: ${plannerResponse.status} - ${errText}`);
          }

          const plannerData = await plannerResponse.json();
          const rawContent = plannerData.choices[0]?.message?.content;
          console.log("[Wireframe] STYLED: Planner response", rawContent ? "has content" : "empty");
          if (!rawContent) {
            figma.notify('Planner: Keine Antwort erhalten.');
            throw new Error('Planner returned empty content');
          }
          const plannerContent = parseAIResponse(rawContent);
          // Support: { sections: [...] }, or array [ { type: "thinking" }, { type: "section", name, description }, ... ], or any object with an array of section-like items
          let sections: Array<{ type: string; name: string; description: string }> = [];
          if (Array.isArray(plannerContent?.sections)) {
            sections = plannerContent.sections;
          } else if (Array.isArray(plannerContent)) {
            sections = plannerContent.filter((o: any) => o && o.type === "section" && o.name && o.description);
          } else if (plannerContent && typeof plannerContent === "object") {
            const arr = plannerContent.sections ?? plannerContent.plan ?? Object.values(plannerContent).find((v: any) => Array.isArray(v) && v.some((x: any) => x && x.name && x.description));
            if (Array.isArray(arr)) sections = arr.filter((o: any) => o && (o.type === "section" || o.name) && o.name && o.description);
          }
          // If Planner returned retrieval-shaped JSON (componentIds/pageIds) by mistake, sections is empty
          if (sections.length === 0 && plannerContent && typeof plannerContent === "object" && Array.isArray(plannerContent.componentIds)) {
            console.warn("[Wireframe] STYLED: Planner returned retrieval-shaped JSON (componentIds), sections empty");
            figma.notify("Planner-Antwort unerwartetes Format – nutze Fallback mit Prompt.");
          }
          console.log("[Wireframe] STYLED: sections", sections.length, sections.map((s: any) => s.name));
          figma.notify(`Planner: ${sections.length} Sektionen`);

          let lastErrorStyled: string | null = null;
          for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            if (section.type !== "section" || !section.name || !section.description) continue;
            const currentIdx = i + 1;
            reportProgress(`Sektion ${currentIdx}/${sections.length}: ${section.name}...`);
            let lastError: string | null = null;
            let failedCommands: FigmaCommand[] = [];
            let success = false;

            for (let attempt = 1; attempt <= 2 && !success; attempt++) {
              try {
                const statusPrefix = attempt > 1 ? `[Retry ${attempt}] ` : "";
                console.log("[Wireframe] STYLED: section", currentIdx, "attempt", attempt, section.name);
                let researchData = attempt > 1 && lastError ? await performWebSearch(`Figma Plugin API error: ${lastError}`, apiKey) : "";

                reportProgress(`${statusPrefix}Sektion ${currentIdx}: Designer (Design Spec)...`);
                const designRes = await withTimeout(
                  figmaFetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
                    body: JSON.stringify({
                      model: model,
                      messages: [
                        { role: "system", content: DESIGN_SPEC_AGENT_SYSTEM_PROMPT },
                        { role: "user", content: buildDesignSpecPrompt(section, viewport, contextMetadata?.name) },
                      ],
                      response_format: { type: "json_object" },
                    }),
                  }),
                  60000,
                  "Designer Timeout (60s)"
                );
                if (!designRes.ok) throw new Error(`Design Spec API Error: ${designRes.status}`);
                const designData = await designRes.json();
                const msg = designData.choices?.[0]?.message;
                const specFromMsg = msg ? getDesignSpecFromMessage(msg) : null;
                const specInput = specFromMsg != null ? sanitizeDesignSpecForExecutor(specFromMsg) : section.description;

                reportProgress(`${statusPrefix}Sektion ${currentIdx}: Figma-Agent (Befehle)...`);
                const apiExpertMessages = [
                  { role: "system", content: FIGMA_API_EXPERT_SYSTEM_PROMPT },
                  { role: "user", content: buildApiExpertPrompt(specInput, lastError || undefined, failedCommands.length > 0 ? failedCommands : undefined, researchData || undefined) },
                ];
                console.log("[Wireframe] STYLED: section", currentIdx, "calling Figma Executor...");
                const apiResult = await withTimeout(
                  callFigmaExecutor(apiExpertMessages, model, apiKey),
                  75000,
                  "Figma-Agent Timeout (75s)"
                );
                console.log("[Wireframe] STYLED: Executor response", apiResult.content ? "has content" : "null", typeof apiResult.content === 'string' ? apiResult.content.length : "");

                const content = apiResult.content ? parseAIResponse(apiResult.content) : null;
                if (content && Array.isArray(content.commands) && content.rootId) {
                  console.log("[Wireframe] STYLED: section", currentIdx, "runCommands", content.commands.length, content.rootId);
                  figma.notify(`Führe ${content.commands.length} Befehle aus…`);
                  let result: Awaited<ReturnType<typeof runCommands>>;
                  try {
                    result = await runCommands(content.commands as FigmaCommand[], content.rootId, contextNode);
                  } catch (runErr: any) {
                    const runMsg = runErr?.message ?? String(runErr);
                    console.error('[Wireframe] runCommands threw:', runMsg, runErr);
                    figma.notify(`Befehle Fehler: ${runMsg.substring(0, 60)}…`, { timeout: 6000 });
                    lastError = runMsg;
                    lastErrorStyled = runMsg;
                    failedCommands = [];
                    reportProgress(`Sektion ${currentIdx}: Korrigiere...`);
                    result = { success: false, error: runMsg };
                  }
                  if (result.success && result.nodes.length > 0) {
                    const validNodes = result.nodes.filter((n) => n.parent !== null);
                    if (validNodes.length > 0) {
                      allNewNodes.push(...validNodes);
                      if (currentIdx === 1) figma.notify(`Sektion "${section.name}" erstellt`);
                      try { figma.viewport.scrollAndZoomIntoView(validNodes); } catch (_) {}
                    }
                    success = true;
                    console.log("[Wireframe] STYLED: section", currentIdx, "success, nodes", result.nodes?.length);
                  } else if (!result.success) {
                    lastError = result.error;
                    lastErrorStyled = result.error;
                    failedCommands = result.failedCommand ? [result.failedCommand] : [];
                    const errMsg = result.error || 'Unbekannter Fehler';
                    console.error("[Wireframe] STYLED: section", currentIdx, "Befehle fehlgeschlagen:", errMsg, "failedCommandIndex:", result.failedCommandIndex, "failedCommand:", result.failedCommand);
                    figma.notify(`Befehle fehlgeschlagen: ${errMsg.substring(0, 60)}…`, { timeout: 6000 });
                    reportProgress(`Sektion ${currentIdx}: Korrigiere...`);
                  }
                } else {
                  lastError = "Invalid response: missing commands or rootId";
                  if (!content) console.error('[Wireframe] Executor: apiResult.content null or parse failed', !!apiResult.content);
                  else console.error('[Wireframe] Executor: parsed content missing commands or rootId', { hasCommands: Array.isArray(content?.commands), rootId: content?.rootId });
                  figma.notify('Executor: Keine Befehle in Antwort', { timeout: 5000 });
                }
              } catch (err: unknown) {
                const isAbort = typeof err === 'object' && err != null && (err as Error).name === 'AbortError';
                lastError = isAbort ? 'Sektion-Timeout (Designer 60s / Figma-Agent 75s)' : (err instanceof Error ? err.message : String(err));
                figma.notify(isAbort ? `Sektion ${currentIdx}: Timeout` : `Fehler: ${(err instanceof Error ? err.message : String(err)).substring(0, 50)}…`);
                if (attempt >= 2) reportProgress(`Sektion ${currentIdx} übersprungen.`);
              }
            }
          }

          // Fallback: if Planner returned no sections, run one section with the full prompt
          if (sections.length === 0 && contextNode) {
            console.log("[Wireframe] STYLED: fallback (no sections), one section from prompt");
            reportProgress("Planner lieferte keine Sektionen – erstelle eine Sektion aus dem Prompt...");
            try {
              const fallbackSection = { name: "Wireframe", description: prompt };
              const designRes = await figmaFetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
                body: JSON.stringify({
                  model: model,
                  messages: [
                    { role: "system", content: DESIGN_SPEC_AGENT_SYSTEM_PROMPT },
                    { role: "user", content: buildDesignSpecPrompt(fallbackSection, viewport, contextMetadata?.name) },
                  ],
                  response_format: { type: "json_object" },
                }),
              });
              if (designRes.ok) {
                const designData = await designRes.json();
                const fallbackMsg = designData.choices?.[0]?.message;
                const fallbackSpec = fallbackMsg ? getDesignSpecFromMessage(fallbackMsg) : null;
                const specInput = fallbackSpec != null ? sanitizeDesignSpecForExecutor(fallbackSpec) : prompt;
                const apiExpertMessages = [
                  { role: "system", content: FIGMA_API_EXPERT_SYSTEM_PROMPT },
                  { role: "user", content: buildApiExpertPrompt(specInput) },
                ];
                const apiResult = await callFigmaExecutor(apiExpertMessages, model, apiKey);
                const content = apiResult.content ? parseAIResponse(apiResult.content) : null;
                if (content && Array.isArray(content.commands) && content.rootId) {
                  try {
                    const result = await runCommands(content.commands as FigmaCommand[], content.rootId, contextNode);
                    if (result.success && result.nodes.length > 0) {
                      const validNodes = result.nodes.filter((n) => n.parent !== null);
                      if (validNodes.length > 0) allNewNodes.push(...validNodes);
                    } else if (!result.success) {
                      const errMsg = result.error || 'Unbekannter Fehler';
                      console.error('[Wireframe] Fallback Befehle fehlgeschlagen:', errMsg, result);
                      figma.notify(`Fallback: ${errMsg.substring(0, 60)}…`, { timeout: 6000 });
                    }
                  } catch (runErr: any) {
                    const runMsg = runErr?.message ?? String(runErr);
                    console.error('[Wireframe] Fallback runCommands threw:', runMsg, runErr);
                    figma.notify(`Befehle Fehler: ${runMsg.substring(0, 60)}…`, { timeout: 6000 });
                  }
                } else {
                  figma.notify('Fallback: Keine Befehle in Executor-Antwort');
                }
              }
            } catch (e) {
              console.warn("Fallback section failed:", e);
              figma.notify(`Fallback: ${(e as Error)?.message ?? String(e)}`);
            }
          }

          console.log("[Wireframe] STYLED: loop done", "allNewNodes", allNewNodes.length);
          reportProgress("Fertig!");
          if (allNewNodes.length > 0) {
            figma.notify(`Wireframe: ${allNewNodes.length} Elemente erstellt`);
          } else {
            if (lastErrorStyled) {
              console.error('[Wireframe] Keine Elemente – letzter Fehler:', lastErrorStyled);
              figma.ui.postMessage({ type: 'wireframe-error', error: lastErrorStyled });
            }
            figma.notify('Fertig. Keine Elemente erstellt – Executor oder Befehle prüfen.', { timeout: 5000 });
          }
          const focusNodes = allNewNodes.length > 0 ? allNewNodes : (contextNode ? [contextNode as SceneNode] : []);
          const validFocus = focusNodes.filter((n) => n.parent !== null);
          if (validFocus.length > 0) {
            try {
              figma.currentPage.selection = validFocus;
              figma.viewport.scrollAndZoomIntoView(validFocus);
            } catch (e) {
              console.warn("Could not set selection after wireframe:", e);
            }
          }
          figma.ui.postMessage({ type: 'wireframe-generated', nodeCount: allNewNodes.length });
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

      case 'generate-concept-prompt': {
        const { prompt, apiKey, viewport } = msg as { prompt: string; apiKey: string; viewport?: string };
        if (!apiKey || typeof apiKey !== 'string') {
          figma.notify('OpenAI API-Key fehlt.');
          figma.ui.postMessage({ type: 'concept-prompt-error', error: 'Missing API key' });
          break;
        }
        try {
          figma.notify('Konzeptionsprompt: Generiere…');
          const systemPrompt = `Du bist ein UX- und Technik-Redakteur. Deine Aufgabe ist, einen **Konzeptionsprompt** zu erstellen, der zwei Ziele hat:

1. **WIREFRAME-ERKLÄRUNG & INHALT**
   - Beschreibe den kompletten Wireframe-Aufbau (Sektionen, Reihenfolge, Layout).
   - Ordne jeder Sektion/Bereich konkrete **Inhalte** zu: Überschriften, Texte, CTAs, Platzhalter (Bilder, Icons), Daten/Listen.
   - Halte es präzise und kopierbar (z.B. "Hero: H1 = …, Subline = …, Primary CTA = …, Secondary CTA = …").

2. **ANWEISUNGEN FÜR FIGMA MAKE**
   Figma Make ist ein AI-Tool (Vision + Prompt-to-Code), das aus Beschreibungen und Designs funktionierende Prototypen/Web-Apps baut (React, AI-Chat). Dein Abschnitt soll so formuliert sein, dass der Nutzer ihn 1:1 in den Figma-Make-Chat einfügen kann.
   - Gib klare, stückweise Anweisungen: welche Komponenten/Sektionen in welcher Reihenfolge gebaut werden sollen.
   - **Styling**: Konkrete Vorgaben (Farben, Typografie, Abstände, Breakpoints, Dark/Light), damit das Ergebnis konsistent ist. Nenne z.B. CSS-Variablen, Tailwind-Klassen oder konkrete Werte.
   - **Struktur**: Empfehle semantisches HTML/React (Header, Main, Section, Article, Nav), Barrierefreiheit (ARIA, Kontrast), Responsive (Mobile-first oder Breakpoints).
   - Formuliere so, dass Figma Make den Wireframe 1:1 umsetzen kann, inkl. Styling und Inhalt.

Antworte nur mit dem Konzeptionsprompt (Fließtext + klare Abschnitte/Listen). Kein Meta-Kommentar, keine Einleitung wie "Hier ist der Prompt".`;
          const userContent = `Erstelle den Konzeptionsprompt für folgenden Wireframe:\n\n${prompt}\n\nViewport/Kontext: ${viewport || 'Desktop'}.`;
          const res = await figmaFetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent },
              ],
              max_tokens: 4096,
            }),
          });
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`OpenAI: ${res.status} - ${errText}`);
          }
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content?.trim();
          if (!text) throw new Error('Keine Antwort erhalten');
          figma.notify('Konzeptionsprompt erstellt');
          figma.ui.postMessage({ type: 'concept-prompt-generated', prompt: text });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          figma.notify(`Fehler: ${errMsg.substring(0, 40)}…`);
          figma.ui.postMessage({ type: 'concept-prompt-error', error: errMsg });
        }
        break;
      }

      case 'generate-wireframe-concept': {
        const { prompt, apiKey, viewport: viewportParam, imageSize: imageSizeOption } = msg as {
          prompt: string;
          apiKey: string;
          viewport?: string;
          imageSize?: string;
        };
        if (!apiKey || typeof apiKey !== 'string') {
          figma.notify('OpenAI API-Key fehlt.');
          figma.ui.postMessage({ type: 'concept-assembly-error', error: 'Missing API key' });
          break;
        }
        const viewport = typeof viewportParam === 'string' && viewportParam ? viewportParam : 'desktop';
        const imageSize = imageSizeOption === '1536x1024' || imageSizeOption === '1024x1024' ? imageSizeOption : '1024x1536';
        const [sectionWidth, sectionHeight] =
          imageSize === '1024x1536' ? [1024, 1536] : imageSize === '1536x1024' ? [1536, 1024] : [1024, 1024];
        const wireframePrefix = 'Wireframe, UI mockup, simple grayscale or light gray layout sketch, clean lines, no photorealism, digital wireframe style. ';
        try {
          figma.ui.postMessage({ type: 'generation-progress', message: 'Konzept wird erstellt…' });
          figma.notify('Konzeptionsagent: Planung…');
          const conceptRes = await figmaFetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: CONCEPT_AGENT_SYSTEM_PROMPT },
                { role: 'user', content: buildConceptPrompt(prompt, viewport) },
              ],
              max_tokens: 8192,
              response_format: { type: 'json_object' },
            }),
          });
          if (!conceptRes.ok) {
            const errText = await conceptRes.text();
            throw new Error(`Konzeptionsagent: ${conceptRes.status} - ${errText}`);
          }
          const conceptData = await conceptRes.json();
          const rawContent = conceptData.choices?.[0]?.message?.content?.trim();
          if (!rawContent) throw new Error('Konzeptionsagent: Keine Antwort');
          let concept: { sections?: Array<{ name?: string; description?: string; contentHints?: string; imagePrompt?: string }>; implementationPrompt?: string };
          try {
            concept = JSON.parse(rawContent) as typeof concept;
          } catch {
            throw new Error('Konzeptionsagent: Ungültiges JSON');
          }
          const sections = Array.isArray(concept.sections) ? concept.sections : [];
          const implementationPrompt = typeof concept.implementationPrompt === 'string' ? concept.implementationPrompt : '';
          if (sections.length === 0) {
            figma.ui.postMessage({ type: 'concept-assembly-error', error: 'Konzept enthält keine Sektionen' });
            figma.notify('Konzept: Keine Sektionen');
            break;
          }
          const sectionFrames: FrameNode[] = [];
          for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const imagePrompt = typeof section.imagePrompt === 'string' && section.imagePrompt
              ? section.imagePrompt
              : (section.name || `Section ${i + 1}`);
            figma.ui.postMessage({
              type: 'generation-progress',
              message: `Sektion ${i + 1}/${sections.length}: Bild wird generiert…`,
            });
            figma.notify(`Sektion ${i + 1}/${sections.length}…`);
            const imgRes = await figmaFetch('https://api.openai.com/v1/images/generations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
              body: JSON.stringify({
                model: 'gpt-image-1.5',
                prompt: wireframePrefix + imagePrompt,
                n: 1,
                size: imageSize,
                quality: 'low',
              }),
            });
            if (!imgRes.ok) {
              const errText = await imgRes.text();
              throw new Error(`Bild Sektion ${i + 1}: ${imgRes.status} - ${errText}`);
            }
            const imgJson = await imgRes.json();
            const b64 = imgJson.data?.[0]?.b64_json;
            if (!b64 || typeof b64 !== 'string') throw new Error(`Sektion ${i + 1}: Kein Bild in Antwort`);
            const bytes = base64DecodeToUint8Array(b64);
            const image = figma.createImage(bytes);
            const frame = figma.createFrame();
            frame.name = `Sektion: ${section.name ?? `Section ${i + 1}`}`;
            frame.resize(sectionWidth, sectionHeight);
            frame.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
            sectionFrames.push(frame);
          }
          const parentName = `Wireframe – ${prompt.slice(0, 40).replace(/\n/g, ' ')}${prompt.length > 40 ? '…' : ''}`;
          const parent = figma.createFrame();
          parent.name = parentName;
          parent.layoutMode = 'VERTICAL';
          parent.primaryAxisAlignItems = 'MIN';
          parent.itemSpacing = 0;
          parent.paddingTop = parent.paddingBottom = parent.paddingLeft = parent.paddingRight = 0;
          for (const child of sectionFrames) parent.appendChild(child);
          figma.currentPage.appendChild(parent);
          try {
            const nodes = parent.parent ? [parent] : [];
            if (nodes.length) figma.currentPage.selection = nodes;
            figma.viewport.scrollAndZoomIntoView(nodes.length ? nodes : [parent]);
          } catch (_) {}
          figma.notify(`${sections.length} Sektionen auf Canvas platziert`);
          figma.ui.postMessage({
            type: 'concept-assembly-done',
            implementationPrompt,
            sectionCount: sections.length,
          });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          figma.notify(`Fehler: ${errMsg.substring(0, 50)}…`);
          figma.ui.postMessage({ type: 'concept-assembly-error', error: errMsg });
        }
        break;
      }

      case 'generate-wireframe-image': {
        const { prompt, apiKey, size: sizeOption } = msg as { prompt: string; apiKey: string; size?: string };
        if (!apiKey || typeof apiKey !== 'string') {
          figma.notify('OpenAI API-Key fehlt.');
          figma.ui.postMessage({ type: 'wireframe-image-error', error: 'Missing API key' });
          break;
        }
        const size = sizeOption === '1536x1024' || sizeOption === '1024x1024' ? sizeOption : '1024x1536';
        const [width, height] = size === '1024x1536' ? [1024, 1536] : size === '1536x1024' ? [1536, 1024] : [1024, 1024];
        figma.ui.postMessage({ type: 'generation-progress', message: 'Bild wird generiert…' });
        try {
          figma.notify('Wireframe-Bild: Generiere…');
          const imagePrompt = `Wireframe, UI mockup, simple grayscale or light gray layout sketch: ${prompt}. Clean lines, no photorealism, digital wireframe style.`;
          const res = await figmaFetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: 'gpt-image-1.5',
              prompt: imagePrompt,
              n: 1,
              size,
              quality: 'low',
            }),
          });
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`OpenAI Images: ${res.status} - ${errText}`);
          }
          const json = await res.json();
          const b64 = json.data?.[0]?.b64_json;
          if (!b64 || typeof b64 !== 'string') {
            throw new Error('Kein Bild in Antwort');
          }
          const bytes = base64DecodeToUint8Array(b64);
          const image = figma.createImage(bytes);
          const frame = figma.createFrame();
          frame.name = 'Wireframe (Bild)';
          frame.resize(width, height);
          frame.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
          figma.currentPage.appendChild(frame);
          figma.currentPage.selection = [frame];
          figma.viewport.scrollAndZoomIntoView([frame]);
          figma.notify('Wireframe-Bild auf Canvas platziert');
          figma.ui.postMessage({ type: 'wireframe-image-generated' });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          figma.notify(`Fehler: ${errMsg.substring(0, 50)}…`);
          figma.ui.postMessage({ type: 'wireframe-image-error', error: errMsg });
        }
        break;
      }

      case 'insert-tool-button': {
        const nodeMap = new Map<string, SceneNode>();
        const rootId = createFrame(nodeMap, {
          id: 'root',
          name: 'Tool test root',
          width: 400,
          height: 300,
          layoutMode: 'VERTICAL',
          itemSpacing: 12,
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 16,
          paddingRight: 16,
        });
        const rootNode = nodeMap.get(rootId);
        if (rootNode) figma.currentPage.appendChild(rootNode);
        const result = await createButton(
          { nodeMap },
          { parentId: 'root', label: 'Mehr erfahren', variant: 'outline' }
        );
        if (result.success) {
          figma.notify('Button (Tool) eingefügt');
          figma.ui.postMessage({ type: 'insert-tool-button-done', buttonId: result.buttonId });
          try {
            const btn = nodeMap.get(result.buttonId);
            if (btn) figma.viewport.scrollAndZoomIntoView([btn]);
          } catch (_) {}
        } else {
          figma.notify(`Fehler: ${result.error.substring(0, 50)}…`);
          figma.ui.postMessage({ type: 'insert-tool-button-error', error: result.error });
        }
        break;
      }

      case 'insert-tool-wireframe': {
        const nodeMap = new Map<string, SceneNode>();
        const ctx = { nodeMap };
        const stageResult = createStage(ctx, { width: 400, height: 400, name: 'Wireframe', id: 'stage' });
        if (!stageResult.success) {
          figma.notify(`Bühne: ${stageResult.error.substring(0, 50)}…`);
          figma.ui.postMessage({ type: 'insert-tool-wireframe-error', error: stageResult.error });
          break;
        }
        const sectionOut = await executeTool(ctx, 'createSection', {
          parentId: 'stage',
          name: 'Hero',
          direction: 'vertical',
          gap: 12,
          padding: 16,
          width: 400,
          height: 280,
        });
        if (!sectionOut.success) {
          figma.notify(`Section: ${sectionOut.error.substring(0, 50)}…`);
          figma.ui.postMessage({ type: 'insert-tool-wireframe-error', error: sectionOut.error });
          break;
        }
        const sectionId = (sectionOut.result as { sectionId: string }).sectionId;
        const textOut = await executeTool(ctx, 'addText', {
          parentId: sectionId,
          content: 'Willkommen',
          variant: 'h1',
        });
        if (!textOut.success) {
          figma.notify(`Text: ${textOut.error.substring(0, 50)}…`);
          figma.ui.postMessage({ type: 'insert-tool-wireframe-error', error: textOut.error });
          break;
        }
        const btnOut = await executeTool(ctx, 'createButton', {
          parentId: sectionId,
          label: 'Mehr erfahren',
          variant: 'outline',
        });
        if (!btnOut.success) {
          figma.notify(`Button: ${btnOut.error.substring(0, 50)}…`);
          figma.ui.postMessage({ type: 'insert-tool-wireframe-error', error: btnOut.error });
          break;
        }
        figma.notify('Wireframe (Tools) eingefügt');
        figma.ui.postMessage({ type: 'insert-tool-wireframe-done', sectionId });
        try {
          const sectionNode = nodeMap.get(sectionId);
          if (sectionNode) figma.viewport.scrollAndZoomIntoView([sectionNode]);
        } catch (_) {}
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

