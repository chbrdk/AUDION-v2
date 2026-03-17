# AUDION Figma Plugin

Figma Plugin für direkten Chat mit AUDION-Personas über Design-Auswahlen.

## Quick Start

1. **Installation:**
   ```bash
   npm install
   ```

2. **Build:**
   ```bash
   npm run build
   ```

3. **In Figma laden:**
   - Figma Desktop App öffnen
   - Plugins → Development → Import plugin from manifest...
   - `manifest.json` auswählen

## Development

```bash
# Watch mode für Entwicklung
npm run dev

# Type checking
npm run typecheck
```

## Features

- ✅ Automatische Selection Detection (Artboards, Groups, Frames)
- ✅ Screenshot Capture der Auswahl
- ✅ Persona Chat Integration
- ✅ Conversation History (persistent)
- ✅ Settings Management

## Dokumentation

Siehe [knowledge/figma-plugin-integration.md](../../knowledge/figma-plugin-integration.md) für vollständige Dokumentation.

## Projektstruktur

```
src/
├── code.ts              # Plugin Main Code
├── ui.tsx               # React UI
├── api/                 # API Clients
├── components/          # React Components
├── services/            # Business Logic
└── types/               # TypeScript Types
```

## Build Output

- `dist/code.js` - Plugin Code
- `dist/ui.js` - UI Bundle
- `ui.html` - UI HTML (mit React CDN)

## Troubleshooting

Siehe [Dokumentation](../../knowledge/figma-plugin-integration.md#troubleshooting) für häufige Probleme und Lösungen.



