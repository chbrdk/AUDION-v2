import { create } from 'zustand';
import type { 
  Persona, 
  SelectionMetadata, 
  ConversationHistory, 
  PluginSettings, 
  ComponentKnowledgeBase 
} from '../../types';
import type { JourneyImportedSectionRow } from '../../services/journey-imported-section';
import type { PromptSiteRenderMeta } from '../../prompt-site-render-meta';
import type { RAGComponentPayload } from '../../services/rag-selection-service';

export type View = 'chat' | 'settings' | 'login' | 'journeys' | 'experimental';
export type ExperimentalSubPage = null | 'llmdesigner' | 'dsldesigner' | 'ragdesign' | 'htmltofigma';

interface PluginState {
  // Navigation
  view: View;
  setView: (view: View) => void;
  experimentalSubPage: ExperimentalSubPage;
  setExperimentalSubPage: (page: ExperimentalSubPage) => void;

  // Global Data
  settings: PluginSettings | null;
  setSettings: (settings: PluginSettings | null) => void;
  knowledgeBase: ComponentKnowledgeBase;
  setKnowledgeBase: (kb: ComponentKnowledgeBase) => void;

  // Selection & Context
  selection: SelectionMetadata | null;
  setSelection: (sel: SelectionMetadata | null) => void;
  selectedPersona: Persona | null;
  setSelectedPersona: (persona: Persona | null) => void;
  conversation: ConversationHistory | null;
  setConversation: (conv: ConversationHistory | null) => void;
  screenshot: string | null;
  setScreenshot: (b64: string | null) => void;

  // General UI States
  isLoggingIn: boolean;
  setIsLoggingIn: (val: boolean) => void;
  loginError: string | null;
  setLoginError: (err: string | null) => void;

  // Generation & Agent States
  isGeneratingWireframe: boolean;
  setIsGeneratingWireframe: (val: boolean) => void;
  generationProgress: string | null;
  setGenerationProgress: (val: string | null) => void;
  
  // Knowledge Operations
  isScanningComponents: boolean;
  setIsScanningComponents: (val: boolean) => void;
  isScanningPage: boolean;
  setIsScanningPage: (val: boolean) => void;

  // HTML to Figma
  htmlToFigmaLoading: boolean;
  setHtmlToFigmaLoading: (val: boolean) => void;
  htmlToFigmaError: string | null;
  setHtmlToFigmaError: (err: string | null) => void;
  htmlToFigmaSuccess: boolean;
  setHtmlToFigmaSuccess: (val: boolean) => void;

  // RAG / Compose
  ragComponents: RAGComponentPayload[] | null;
  setRagComponents: (val: RAGComponentPayload[] | null) => void;
  ragFileKey: string;
  setRagFileKey: (val: string) => void;
  
  // Site generation
  promptSiteLoading: boolean;
  setPromptSiteLoading: (val: boolean) => void;
  promptSiteError: string | null;
  setPromptSiteError: (err: string | null) => void;
  promptSiteSuccess: boolean;
  setPromptSiteSuccess: (val: boolean) => void;
  promptSitePreviewUrl: string | null;
  setPromptSitePreviewUrl: (url: string | null) => void;
  promptSiteRenderMeta: PromptSiteRenderMeta | null;
  setPromptSiteRenderMeta: (meta: PromptSiteRenderMeta | null) => void;

  // Journey
  journeyBriefLoading: boolean;
  setJourneyBriefLoading: (val: boolean) => void;
  journeyBriefViewport: 'desktop' | 'tablet' | 'mobile';
  setJourneyBriefViewport: (vp: 'desktop' | 'tablet' | 'mobile') => void;
  journeyPromptPrefill: string | null;
  setJourneyPromptPrefill: (val: string | null) => void;
  journeySectionConcepts: unknown[] | null;
  setJourneySectionConcepts: (concepts: unknown[] | null) => void;
  journeyImportedSections: JourneyImportedSectionRow[];
  setJourneyImportedSections: (sections: JourneyImportedSectionRow[]) => void;
}

export const usePluginStore = create<PluginState>((set) => ({
  view: 'chat',
  setView: (view) => set({ view }),
  experimentalSubPage: null,
  setExperimentalSubPage: (page) => set({ experimentalSubPage: page }),
  
  settings: null,
  setSettings: (settings) => set({ settings }),
  knowledgeBase: { components: [], pages: [], lastUpdated: 0 },
  setKnowledgeBase: (kb) => set({ knowledgeBase: kb }),
  
  selection: null,
  setSelection: (sel) => set({ selection: sel }),
  selectedPersona: null,
  setSelectedPersona: (persona) => set({ selectedPersona: persona }),
  conversation: null,
  setConversation: (conv) => set({ conversation: conv }),
  screenshot: null,
  setScreenshot: (b64) => set({ screenshot: b64 }),

  isLoggingIn: false,
  setIsLoggingIn: (val) => set({ isLoggingIn: val }),
  loginError: null,
  setLoginError: (err) => set({ loginError: err }),

  isGeneratingWireframe: false,
  setIsGeneratingWireframe: (val) => set({ isGeneratingWireframe: val }),
  generationProgress: null,
  setGenerationProgress: (val) => set({ generationProgress: val }),

  isScanningComponents: false,
  setIsScanningComponents: (val) => set({ isScanningComponents: val }),
  isScanningPage: false,
  setIsScanningPage: (val) => set({ isScanningPage: val }),

  htmlToFigmaLoading: false,
  setHtmlToFigmaLoading: (val) => set({ htmlToFigmaLoading: val }),
  htmlToFigmaError: null,
  setHtmlToFigmaError: (err) => set({ htmlToFigmaError: err }),
  htmlToFigmaSuccess: false,
  setHtmlToFigmaSuccess: (val) => set({ htmlToFigmaSuccess: val }),

  ragComponents: null,
  setRagComponents: (val) => set({ ragComponents: val }),
  ragFileKey: 'plugin-selection',
  setRagFileKey: (val) => set({ ragFileKey: val }),

  promptSiteLoading: false,
  setPromptSiteLoading: (val) => set({ promptSiteLoading: val }),
  promptSiteError: null,
  setPromptSiteError: (err) => set({ promptSiteError: err }),
  promptSiteSuccess: false,
  setPromptSiteSuccess: (val) => set({ promptSiteSuccess: val }),
  promptSitePreviewUrl: null,
  setPromptSitePreviewUrl: (url) => set({ promptSitePreviewUrl: url }),
  promptSiteRenderMeta: null,
  setPromptSiteRenderMeta: (meta) => set({ promptSiteRenderMeta: meta }),

  journeyBriefLoading: false,
  setJourneyBriefLoading: (val) => set({ journeyBriefLoading: val }),
  journeyBriefViewport: 'desktop',
  setJourneyBriefViewport: (vp) => set({ journeyBriefViewport: vp }),
  journeyPromptPrefill: null,
  setJourneyPromptPrefill: (val) => set({ journeyPromptPrefill: val }),
  journeySectionConcepts: null,
  setJourneySectionConcepts: (concepts) => set({ journeySectionConcepts: concepts }),
  journeyImportedSections: [],
  setJourneyImportedSections: (sections) => set({ journeyImportedSections: sections }),
}));
