# Figma Plugin Integration für AUDION

## Übersicht

Das AUDION Figma Plugin ermöglicht es Designern, direkt in Figma Artboards oder Gruppen zu markieren und mit AUDION-Personas darüber zu chatten. Die Auswahl wird als Screenshot und Metadaten an die AUDION Chat API gesendet, und die Konversation findet im Plugin-Panel statt.

## Features

- **Selection Detection**: Automatische Erkennung von Artboards, Groups und Frames
- **Screenshot Capture**: Automatische Screenshot-Erstellung der Auswahl
- **Persona Chat**: Direkter Chat mit ausgewählten Personas über die Auswahl
- **Conversation History**: Persistente Speicherung der Chat-Historie
- **Settings Management**: Konfigurierbare API-URL und Default-Persona

## Setup Instructions

### Voraussetzungen

- Node.js 22+
- npm oder pnpm
- Figma Desktop App (für Plugin-Entwicklung)

### Installation

1. **Dependencies installieren:**
   ```bash
   cd apps/figma-plugin
   npm install
   ```

2. **Plugin bauen:**
   ```bash
   npm run build
   ```

3. **Plugin in Figma laden:**
   - Öffne Figma Desktop App
   - Gehe zu Plugins → Development → Import plugin from manifest...
   - Wähle `apps/figma-plugin/manifest.json`
   - Plugin erscheint in der Plugin-Liste

### Development Mode

Für Entwicklung mit Hot Reload:

```bash
npm run dev
```

Dies startet Webpack im Watch-Mode. Nach Änderungen muss das Plugin in Figma neu geladen werden (Plugins → Development → [Plugin Name] → Reload).

## API Configuration

### Default API URL

Das Plugin verwendet standardmäßig die Production-URL:
- `https://192.168.50.101/audion/api`

### Konfiguration in Plugin Settings

1. Öffne das Plugin in Figma
2. Wechsle zum "Settings" Tab
3. Trage die gewünschte API-URL ein
4. Klicke auf "Save Settings"

### Environment Variables

Für lokale Entwicklung kann die API-URL auch über die Settings im Plugin konfiguriert werden. Die URL sollte folgendes Format haben:

- Production: `https://192.168.50.101/audion/api`
- Development: `http://localhost:8001` (falls Chat API lokal läuft)

**Wichtig**: Die API-URL muss ohne trailing slash angegeben werden.

## Usage Guide

### 1. Selection auswählen

1. Öffne eine Figma-Datei
2. Wähle ein Artboard, eine Group oder einen Frame aus
3. Das Plugin erkennt die Auswahl automatisch

### 2. Persona auswählen

1. Im Plugin-Panel wird eine Dropdown-Liste mit verfügbaren Personas angezeigt
2. Wähle eine Persona aus (oder verwende die Default-Persona aus Settings)
3. Die Persona-Informationen werden angezeigt

### 3. Chat starten

1. Nach Auswahl von Selection und Persona ist der Chat bereit
2. Tippe eine Nachricht in das Input-Feld
3. Klicke auf "Send" oder drücke Enter
4. Die Nachricht wird mit Screenshot und Metadaten an AUDION gesendet
5. Die Antwort der Persona erscheint im Chat

### 4. Conversation History

- Die Chat-Historie wird automatisch gespeichert
- Beim erneuten Öffnen des Plugins mit derselben Selection und Persona wird die Historie geladen
- Historie kann in Settings gelöscht werden

## API Integration Details

### Endpoints

Das Plugin nutzt folgende AUDION API Endpoints:

- `GET /api/persona-backend/personas` - Liste aller Personas
- `GET /api/persona-backend/target-groups` - Liste aller Target Groups
- `POST /api/chat/message` - Nachricht senden
- `POST /api/chat/images/upload` - Screenshot hochladen
- `WS /api/chat/ws/chat/{conversation_id}` - WebSocket für Streaming (optional)

### Request Format

**Chat Message:**
```typescript
{
  persona_id: string;
  content: string;
  image_ids?: string[];  // Uploaded screenshot IDs
  conversation_id?: string;  // For history
  metadata?: {
    selection: {
      nodeId: string;
      name: string;
      type: 'ARTBOARD' | 'GROUP' | 'FRAME';
      bounds: { x, y, width, height };
      layers: Array<{ id, name, type }>;
      figmaUrl: string;
    };
    figma_file_id: string;
  };
}
```

**Image Upload:**
```typescript
{
  image: string;  // Base64 data URL
}
```

### Response Format

**Chat Response:**
```typescript
{
  response: string;
  sources: Array<{
    chunk_id: string;
    document_id: string;
    content: string;
    confidence: number;
  }>;
  persona_id: string;
}
```

## Troubleshooting

### Plugin lädt nicht

1. **Prüfe Build:**
   ```bash
   cd apps/figma-plugin
   npm run build
   ```
   Stelle sicher, dass `dist/code.js` und `dist/ui.js` erstellt wurden.

2. **Prüfe Manifest:**
   - Öffne `manifest.json`
   - Stelle sicher, dass `main` auf `code.js` und `ui` auf `ui.html` zeigt
   - Prüfe, ob `networkAccess.allowedDomains` die API-URL enthält

3. **Console Logs:**
   - Öffne Figma DevTools (Plugins → Development → Show/Hide Console)
   - Prüfe auf Fehler in der Console

### API-Verbindungsfehler

1. **Prüfe API-URL:**
   - Öffne Plugin Settings
   - Stelle sicher, dass die API-URL korrekt ist
   - Teste die URL im Browser (z.B. `https://192.168.50.101/audion/api/persona-backend/personas`)

2. **CORS-Probleme:**
   - Figma Plugins laufen in einem Sandbox
   - Stelle sicher, dass die AUDION API CORS für Figma erlaubt
   - Oder verwende die Figma Desktop App (kein CORS)

3. **Network Access:**
   - Prüfe `manifest.json` → `networkAccess.allowedDomains`
   - Füge die API-Domain hinzu falls fehlend

### Screenshots werden nicht gesendet

1. **Prüfe Selection:**
   - Stelle sicher, dass ein Artboard, Group oder Frame ausgewählt ist
   - Andere Node-Typen werden nicht unterstützt

2. **Prüfe Screenshot-Service:**
   - Öffne Console und prüfe auf Fehler beim Screenshot
   - Große Screenshots können zu Timeouts führen

3. **Image Upload:**
   - Prüfe, ob `/api/chat/images/upload` erreichbar ist
   - Prüfe Console für Upload-Fehler

### Personas werden nicht geladen

1. **Prüfe API-Verbindung:**
   - Teste `GET /api/persona-backend/personas` direkt
   - Prüfe Console für API-Fehler

2. **Prüfe API-URL:**
   - Stelle sicher, dass die API-URL in Settings korrekt ist
   - Prüfe, ob die URL ohne trailing slash ist

### Conversation History wird nicht gespeichert

1. **Prüfe Client Storage:**
   - Figma Client Storage hat ein Limit von ~1MB
   - Zu viele Conversations können das Limit überschreiten
   - Lösche alte Conversations in Settings

2. **Prüfe Storage Keys:**
   - Storage Key: `audion-conversations`
   - Prüfe Console für Storage-Fehler

## Known Limitations

1. **Figma API Limits:**
   - Screenshot-Größe ist begrenzt (max 2048x2048px)
   - Client Storage Limit: ~1MB
   - Selection: Nur Artboards, Groups und Frames werden unterstützt

2. **WebSocket Support:**
   - WebSocket wird unterstützt, aber nicht standardmäßig verwendet
   - Fallback auf REST API bei WebSocket-Fehlern

3. **Image Upload:**
   - Große Screenshots können zu Timeouts führen
   - Bilder werden automatisch skaliert auf max 2048x2048px

4. **CORS:**
   - Plugin muss in Figma Desktop App laufen (kein CORS)
   - Browser-Version kann CORS-Probleme haben

## Development

### Projektstruktur

```
apps/figma-plugin/
├── src/
│   ├── code.ts              # Plugin Main Code (Figma Sandbox)
│   ├── ui.tsx               # React UI Component
│   ├── api/
│   │   ├── audion-client.ts # AUDION API Client
│   │   └── figma-api.ts     # Figma API Wrapper
│   ├── components/
│   │   ├── ChatPanel.tsx
│   │   ├── PersonaSelector.tsx
│   │   ├── SelectionInfo.tsx
│   │   └── SettingsPanel.tsx
│   ├── services/
│   │   ├── selection-service.ts
│   │   ├── screenshot-service.ts
│   │   └── conversation-service.ts
│   └── types/
│       └── index.ts
├── manifest.json
├── package.json
├── webpack.config.js
└── ui.html
```

### Build Process

1. **TypeScript Compilation:**
   - `ts-loader` kompiliert TypeScript zu JavaScript
   - Output: `dist/code.js` und `dist/ui.js`

2. **Webpack Bundling:**
   - Code und UI werden separat gebundelt
   - React wird als externes Dependency geladen (via CDN in `ui.html`)

3. **Manifest:**
   - `manifest.json` definiert Plugin-Metadaten
   - `main`: Entry Point für Plugin Code
   - `ui`: HTML File für Plugin UI

### Testing

Tests sind konzeptionell vorhanden, aber Figma Plugins laufen in einem Sandbox und können nicht direkt mit Standard-Testing-Frameworks getestet werden. Tests erfordern Mocking der Figma API.

**Test-Dateien:**
- `src/services/selection-service.test.ts`
- `src/api/audion-client.test.ts`
- `src/services/conversation-service.test.ts`

### Debugging

1. **Console Logs:**
   - Öffne Figma DevTools (Plugins → Development → Show/Hide Console)
   - Logs erscheinen in der Console

2. **Browser DevTools:**
   - Für UI-Debugging: Rechtsklick auf Plugin-Panel → Inspect
   - Öffnet Browser DevTools für UI-Code

3. **Network Requests:**
   - Prüfe Network Tab in Browser DevTools
   - API-Requests können dort verfolgt werden

## Deployment

### Build für Production

```bash
cd apps/figma-plugin
npm run build
```

### Plugin verteilen

1. **Lokale Verteilung:**
   - Plugin kann als `.figma` File exportiert werden
   - Oder direkt `manifest.json` + `dist/` Ordner teilen

2. **Figma Plugin Marketplace:**
   - Für öffentliche Verteilung
   - Erfordert Figma Developer Account
   - Siehe: https://www.figma.com/plugin-docs/publish/

## URLs und Pfade

### Zentrale Referenz

Alle URLs sollten aus der zentralen Config referenziert werden:
- `knowledge/audion-base-path-configuration.md`

### Production URLs

- **Base URL**: `https://192.168.50.101/audion/api`
- **Persona Backend**: `https://192.168.50.101/audion/api/persona-backend`
- **Chat API**: `https://192.168.50.101/audion/api/chat`
- **WebSocket**: `wss://192.168.50.101/audion/api/chat`

### Development URLs

- **Chat API**: `http://localhost:8001`
- **Persona Backend**: `http://localhost:8000`

## Weitere Ressourcen

- [Figma Plugin API Documentation](https://www.figma.com/plugin-docs/)
- [AUDION Project Documentation](../PROJECT_DOCUMENTATION.md)
- [AUDION Base Path Configuration](./audion-base-path-configuration.md)

## Changelog

### 2025-12-XX - Initial Release
- Selection Detection für Artboards, Groups und Frames
- Screenshot Capture und Upload
- Persona Chat Integration
- Conversation History
- Settings Management



