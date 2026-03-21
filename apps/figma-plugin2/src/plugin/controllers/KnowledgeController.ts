import { scanSelectedComponents } from '../../agent/scanner';
import { scanSelectedPage } from '../../agent/page-scanner';
import { KNOWLEDGE_ENRICHMENT_SYSTEM_PROMPT, buildEnrichmentPrompt } from '../../agent/enrichment-agent';
import type { ComponentKnowledgeBase } from '../../types';

export const STORAGE_KEY_KNOWLEDGE = 'audion-knowledge-base';

export function normalizeKnowledge(raw: unknown): ComponentKnowledgeBase {
  if (!raw || typeof raw !== 'object') {
    return { components: [], pages: [], lastUpdated: Date.now() };
  }
  const o = raw as Record<string, unknown>;
  const components = Array.isArray(o.components) ? o.components : [];
  const pages = Array.isArray(o.pages) ? o.pages : [];
  const lastUpdated = typeof o.lastUpdated === 'number' ? o.lastUpdated : Date.now();
  return { components, pages, lastUpdated } as ComponentKnowledgeBase;
}

export const KnowledgeController = {
  async getKnowledge() {
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
  },

  async saveKnowledge(msg: any) {
    try {
      await figma.clientStorage.setAsync(STORAGE_KEY_KNOWLEDGE, msg.knowledge);
      figma.ui.postMessage({
        type: 'knowledge-saved',
      });
    } catch (error) {
      console.error('Failed to save knowledge:', error);
    }
  },

  async scanComponents(figmaFetch: any) {
    try {
      const newComponents = scanSelectedComponents();
      if (newComponents.length === 0) {
        figma.notify('Keine Komponenten in der Auswahl gefunden.');
        return;
      }
      
      figma.notify('Scannen abgeschlossen. Nutze KI für Deep Analysis...', { timeout: 1000 });
      
      const settings = await figma.clientStorage.getAsync('audion-settings');
      const apiKey = settings?.openAiApiKey;
      
      if (apiKey) {
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
                model: "gpt-4o-mini",
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
      
      const current = normalizeKnowledge(await figma.clientStorage.getAsync(STORAGE_KEY_KNOWLEDGE));
      const merged = [...current.components];
      for (const nc of newComponents) {
        const idx = merged.findIndex((c: any) => c.id === nc.id);
        if (idx !== -1) merged[idx] = nc;
        else merged.push(nc);
      }
      
      const updated: ComponentKnowledgeBase = {
        components: merged,
        pages: current.pages,
        lastUpdated: Date.now()
      };
      
      await figma.clientStorage.setAsync(STORAGE_KEY_KNOWLEDGE, updated);
      figma.notify(`${newComponents.length} Komponente(n) mit KI analysiert.`);
      figma.ui.postMessage({ type: 'knowledge-loaded', knowledge: updated });
    } catch (error) {
      console.error('Scanning error:', error);
      figma.notify('Fehler beim Scannen der Komponenten.');
    }
  },

  async scanPage() {
    try {
      const scannedPage = scanSelectedPage();
      if (!scannedPage) {
        figma.notify('Select a single frame or group that represents a full page.');
        return;
      }
      const current = normalizeKnowledge(await figma.clientStorage.getAsync(STORAGE_KEY_KNOWLEDGE));
      const pages = [...(current.pages ?? [])];
      const existingIdx = pages.findIndex((p: any) => p.id === scannedPage.id);
      if (existingIdx >= 0) pages[existingIdx] = scannedPage;
      else pages.push(scannedPage);
      
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
  }
};
