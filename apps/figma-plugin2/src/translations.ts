export type Language = 'de' | 'en';

export const translations = {
  de: {
    // Navigation
    chat: 'CHAT',
    setup: 'SETUP',
    backToChat: 'ZURÜCK ZUM CHAT',

    // SelectionInfo
    noSelection: 'Wähle einen Frame oder eine Gruppe aus, um zu starten.',
    screenshot: 'Screenshot',
    isCapturing: 'Erstelle...',
    changeSelection: 'Ändern',
    captureTooltip: 'Klicken für Screenshot',

    // PersonaSelector
    selectPersona: 'PERSONA AUSWÄHLEN',
    noDefaultPersona: '-- Keine Standard-Persona --',

    // ChatPanel
    chatPlaceholder: 'Stelle eine Frage zu deinem Design...',
    send: 'Senden',
    loading: 'Antwortet...',

    // SettingsPanel
    pluginSetup: 'PLUGIN SETUP',
    apiUrl: 'AUDION API URL',
    discoveryUrl: 'DISCOVERY URL (OPAL)',
    discoveryUrlPlaceholder: 'z.B. https://opal.example.com/.well-known/discovery',
    defaultPersona: 'STANDARD PERSONA',
    brandColor: 'MARKENFARBE',
    language: 'SPRACHE',
    saveSettings: 'EINSTELLUNGEN SPEICHERN',
    saving: 'SPEICHERN...',
    saveSuccess: 'Einstellungen erfolgreich gespeichert',
    dangerZone: 'GEFAHRENZONE',
    clearHistory: 'CHAT-VERLAUF LÖSCHEN',
    historyCleared: 'Verlauf gelöscht',
    confirmClear: 'Bist du sicher, dass du den gesamten Chat-Verlauf löschen möchtest? Dies kann nicht rückgängig gemacht werden.',

    // Login
    login: 'Login',
    email: 'Email',
    password: 'Passwort',
    loggingIn: 'Anmelden...',
    loginError: 'Ungültige Email oder Passwort',
    welcome: 'Willkommen bei AUDION',

    // Journeys
    journeys: 'JOURNEYS',
    selectJourney: 'JOURNEY AUSWÄHLEN',
    visualizeInFigma: 'IN FIGMA VISUALISIEREN',
    loadingJourneys: 'Journeys werden geladen...',
    noJourneys: 'Keine Journeys gefunden.',
    phases: 'Phasen',
    visualizing: 'Visualisierung...',
    visualizeSuccess: 'Journey in Figma visualisiert',

    // Projects
    selectProject: 'PROJEKT AUSWÄHLEN',
    loadingProjects: 'Projekte werden geladen...',
    noProjects: 'Keine Projekte gefunden.',

    // Agent
    agent: 'AGENT',
    describeUI: 'Beschreibe UI / User Story',
    viewport: 'Viewport',
    desktop: 'Desktop (1440px)',
    mobile: 'Mobile (375px)',
    both: 'Beide',
    model: 'KI Modell',
    generateWireframe: 'WIREFRAME GENERIEREN',
    generating: 'Generiere...',
    needApiKey: 'API-Key in SETUP erforderlich',
    generationSuccess: 'Wireframe erstellt',
    generationError: 'Fehler bei der Generierung',
    openAiApiKey: 'OPENAI API KEY',
    show: 'Anzeigen',
    hide: 'Verbergen',
    knowledge: 'WISSEN',
    scanSelection: 'Selection scannen',
    export: 'Exportieren',
    import: 'Importieren',
    knowledgeExported: 'Wissen exportiert',
    knowledgeImported: 'Wissen importiert',
    importError: 'Fehler beim Importieren (ungültiges Format)',
  },
  en: {
    // Navigation
    chat: 'CHAT',
    setup: 'SETUP',
    backToChat: 'BACK TO CHAT',

    // SelectionInfo
    noSelection: 'Select a frame or group to get started.',
    screenshot: 'Screenshot',
    isCapturing: 'Capturing...',
    changeSelection: 'Change',
    captureTooltip: 'Click for screenshot',

    // PersonaSelector
    selectPersona: 'SELECT PERSONA',
    noDefaultPersona: '-- No default persona --',

    // ChatPanel
    chatPlaceholder: 'Ask a question about your design...',
    send: 'Send',
    loading: 'Assistant is typing...',

    // SettingsPanel
    pluginSetup: 'PLUGIN SETUP',
    apiUrl: 'AUDION API URL',
    discoveryUrl: 'DISCOVERY URL (OPAL)',
    discoveryUrlPlaceholder: 'e.g. https://opal.example.com/.well-known/discovery',
    defaultPersona: 'DEFAULT PERSONA',
    brandColor: 'BRAND COLOR',
    language: 'LANGUAGE',
    saveSettings: 'SAVE SETTINGS',
    saving: 'SAVING...',
    saveSuccess: 'Settings saved successfully',
    dangerZone: 'DANGER ZONE',
    clearHistory: 'CLEAR CHAT HISTORY',
    historyCleared: 'History cleared',
    confirmClear: 'Are you sure you want to clear all conversation history? This cannot be undone.',

    // Login
    login: 'Login',
    email: 'Email',
    password: 'Password',
    loggingIn: 'Logging in...',
    loginError: 'Invalid email or password',
    welcome: 'Welcome to AUDION',

    // Journeys
    journeys: 'JOURNEYS',
    selectJourney: 'SELECT JOURNEY',
    visualizeInFigma: 'VISUALIZE IN FIGMA',
    loadingJourneys: 'Loading journeys...',
    noJourneys: 'No journeys found.',
    phases: 'Phases',
    visualizing: 'Visualizing...',
    visualizeSuccess: 'Journey visualized in Figma',

    // Projects
    selectProject: 'SELECT PROJECT',
    loadingProjects: 'Loading projects...',
    noProjects: 'No projects found.',

    // Agent
    agent: 'AGENT',
    describeUI: 'Describe UI / User Story',
    viewport: 'Viewport',
    desktop: 'Desktop (1440px)',
    mobile: 'Mobile (375px)',
    both: 'Both',
    model: 'AI Model',
    generateWireframe: 'GENERATE WIREFRAME',
    generating: 'Generating...',
    needApiKey: 'API key required in SETUP',
    generationSuccess: 'Wireframe generated',
    generationError: 'Error generating wireframe',
    openAiApiKey: 'OPENAI API KEY',
    show: 'Show',
    hide: 'Hide',
    knowledge: 'KNOWLEDGE',
    scanSelection: 'Scan Selection',
    export: 'Export',
    import: 'Import',
    knowledgeExported: 'Knowledge exported',
    knowledgeImported: 'Knowledge imported',
    importError: 'Import error (invalid format)',
  }
};

export type TranslationKey = keyof typeof translations.de;

export function t(key: TranslationKey, lang: Language = 'de'): string {
  return translations[lang][key] || translations['de'][key] || key;
}
