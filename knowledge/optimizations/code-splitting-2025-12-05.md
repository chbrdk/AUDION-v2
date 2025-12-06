# Code Splitting Optimierung - 05. Dezember 2025

## Status: ✅ Teilweise implementiert

## Durchgeführte Optimierungen

### 1. PromptBuilder Code Splitting
**Datei:** `apps/web/app/admin/settings/prompts/page.tsx`

**Implementierung:**
```typescript
import dynamic from "next/dynamic";

const PromptBuilder = dynamic(
  () => import("../../../../components/prompt-builder/PromptBuilder").then((mod) => ({ default: mod.PromptBuilder })),
  {
    loading: () => <div>Loading prompt builder...</div>,
    ssr: false,
  }
);
```

**Vorteile:**
- PromptBuilder wird nur geladen, wenn benötigt
- Reduziert initial Bundle Size
- Bessere First Load Performance

### 2. Bundle Analyzer eingerichtet
**Datei:** `apps/web/next.config.mjs`

**Konfiguration:**
- `@next/bundle-analyzer` hinzugefügt
- Aktivierung via `ANALYZE=true` Environment Variable
- Neuer Script: `npm run build:analyze`

**Verwendung:**
```bash
npm run build:analyze
# Öffnet Bundle-Analyse in Browser
```

## Verbleibende Code Splitting Möglichkeiten

### JourneyCanvas
**Datei:** `apps/web/components/journeys/udg-glass-journey-canvas.tsx`
**Status:** ⏭️ Ausstehend

**Empfehlung:**
```typescript
const JourneyCanvas = dynamic(
  () => import('@/components/journeys/udg-glass-journey-canvas'),
  { ssr: false }
);
```

### KnowledgeExplorer
**Datei:** `apps/web/components/udg-glass-knowledge-explorer.tsx`
**Status:** ⏭️ Ausstehend

**Empfehlung:**
```typescript
const KnowledgeExplorer = dynamic(
  () => import('@/components/udg-glass-knowledge-explorer'),
  { ssr: false }
);
```

## Bundle Size Analyse

### Vorher (zu messen)
- Total Bundle Size: (wird gemessen)
- First Load JS: (wird gemessen)
- Largest Chunks: (wird identifiziert)

### Nachher (Ziel)
- Total Bundle Size: -15%+
- First Load JS: -20%+
- Code Splitting für große Komponenten

## Nächste Schritte

1. ✅ PromptBuilder Code Splitting
2. ✅ Bundle Analyzer eingerichtet
3. ⏭️ Bundle Size messen
4. ⏭️ Weitere große Komponenten identifizieren
5. ⏭️ Code Splitting für JourneyCanvas, KnowledgeExplorer

## Referenzen

- [Next.js Code Splitting](https://nextjs.org/docs/pages/building-your-application/optimizing/lazy-loading)
- [Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)

---

**Erstellt:** 05. Dezember 2025  
**Status:** Teilweise implementiert
