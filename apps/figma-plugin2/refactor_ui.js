const fs = require('fs');
const path = require('path');

const uiFile = path.resolve(__dirname, 'src/ui.tsx');
let code = fs.readFileSync(uiFile, 'utf8');

// The states mapped to Zustand
const storeStates = [
  'view', 'experimentalSubPage', 'selection', 'selectedPersona', 'conversation', 
  'screenshot', 'settings', 'isLoggingIn', 'loginError', 'isGeneratingWireframe', 
  'generationProgress', 'isScanningComponents', 'isScanningPage', 'htmlToFigmaLoading', 
  'htmlToFigmaError', 'htmlToFigmaSuccess', 'ragComponents', 'ragFileKey', 
  'promptSiteLoading', 'promptSiteError', 'promptSiteSuccess', 'promptSitePreviewUrl', 
  'promptSiteRenderMeta', 'journeyBriefLoading', 'journeyBriefViewport', 'journeyPromptPrefill', 
  'journeySectionConcepts', 'journeyImportedSections'
];

let storeHookStr = '  const store = usePluginStore();\n  usePluginBridge();\n';
for (const state of storeStates) {
  const cap = state.charAt(0).toUpperCase() + state.slice(1);
  storeHookStr += `  const ${state} = usePluginStore(s => s.${state});\n`;
  storeHookStr += `  const set${cap} = usePluginStore(s => s.set${cap});\n`;
}

// 1. Remove the target useStates block
for (const state of storeStates) {
  const cap = state.charAt(0).toUpperCase() + state.slice(1);
  const regex = new RegExp(`^\\s*const\\s*\\[${state},\\s*set${cap}\\]\\s*=\\s*useState.*?;[\\r\\n]+`, 'gm');
  code = code.replace(regex, '');
}

// 2. Inject the store hooks where App starts
const appStart = /function App\(\)\s*\{/;
code = code.replace(appStart, `import { usePluginStore } from './ui/store';\nimport { usePluginBridge } from './ui/hooks/usePluginBridge';\n\nfunction App() {\n${storeHookStr}`);

// 3. Remove the entire useEffect messageHandler block
// It starts with `useEffect(() => {\n    // Add global styles` and ends roughly at `}, []);` before `useEffect(() => {\n    if (settings?.brandColor)`
// Since regex over multi-line is tricky, we'll slice by indexing
const startText = `  useEffect(() => {
    // Add global styles`;
const endText = `    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);`;

const startIndex = code.indexOf(startText);
const endIndex = code.indexOf(endText, startIndex);
if (startIndex !== -1 && endIndex !== -1) {
  const blockToRemove = code.substring(startIndex, endIndex + endText.length);
  code = code.replace(blockToRemove, '');
}

fs.writeFileSync(uiFile, code);
console.log('ui.tsx refactored successfully.');
