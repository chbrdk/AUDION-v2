# BuilderIO figma-html Repo – Analyse für HTML → Figma

Quelle: [BuilderIO/figma-html](https://github.com/BuilderIO/figma-html). Das Projekt verweist inzwischen auf die [Builder.io Chrome Extension](https://www.builder.io/c/docs/chrome-extension#paste-from-chrome-into-figma).

## Repo-Struktur (aktuell)

| Pfad | Inhalt |
|------|--------|
| `chrome-extension/` | Chrome-Extension: Popup, Background, **Inject-Script** |
| `shared/` | Nur `typings.ts` / `typings.d.ts` (env), **keine** Konvertierungslogik |
| `lib/` | **404** – im Webpack referenziert (`./lib/html-to-figma/index.ts`), im Repo **nicht mehr vorhanden** |
| `plugin/` | **Nicht im Tree** – Webpack referenziert `./plugin/ui.tsx` und `./plugin/code.ts`, im aktuellen Stand **nicht öffentlich** |

## Ablauf in der Chrome-Extension

1. **Popup** (`chrome-extension/src/popup/Popup.tsx`): User klickt „Capture page“ → sendet `{ inject: true }` an den Background.
2. **Background** (`background.ts`): Führt im aktiven Tab `chrome.tabs.executeScript` mit Datei `js/inject.js` aus.
3. **Inject** (`inject.ts`):
   - `import { htmlToFigma } from "@builder.io/html-to-figma"`
   - `const layers = htmlToFigma("body", location.hash.includes("useFrames=true"))`
   - Erzeugt `{ layers }` als JSON, legt eine Datei `page.figma.json` an und **startet den Download**.
4. User wird angewiesen, das **Figma-Plugin** „HTML to Figma“ zu öffnen und „upload here“ zu wählen, um die heruntergeladene Datei zu importieren.

## Wichtige Erkenntnisse

### 1. HTML → Layers („Figma-JSON“)

- Die eigentliche Konvertierung **DOM → layers** kommt aus dem **npm-Paket** `@builder.io/html-to-figma`, **nicht** aus dem Repo-Quellcode.
- Im Repo ist der Library-Quellcode (`lib/html-to-figma/`) **entfernt** (404).  
  Nutzung nur über:  
  `import { htmlToFigma } from "@builder.io/html-to-figma"`.
- **Laufzeitumgebung:** `htmlToFigma(selector, useFrames?)` erwartet ein **echtes DOM** (z. B. `document.body`). Sie läuft also:
  - in der **Chrome Extension** (Inject-Script im Tab), oder
  - in einem **Headless-Browser** (z. B. Puppeteer/Playwright), der die Seite lädt und das Skript injiziert.
- **Nicht** möglich: reines Backend mit nur „HTML-String parsen“ ohne DOM – die Library arbeitet mit live DOM/CSS.

### 2. Layers → Figma (Import im Plugin)

- Der Schritt **layers-JSON → Figma-Nodes** passiert im **Figma-Plugin** („upload here“).
- Dessen Quellcode (`plugin/`) ist im öffentlichen Repo **nicht** enthalten.
- Die Figma-Plugin-API bietet **kein** `createNodeFromData(JSON)`; man muss die Struktur selbst traversieren und mit `figma.createFrame()`, `figma.createText()` usw. nachbauen.
- Für einen eigenen „HTML to Figma“-Flow müsst ihr also:
  - das **Layer-Format** von `@builder.io/html-to-figma` (z. B. über npm-Paket oder Dumps) verstehen und
  - im **eigenen Plugin** einen **„JSON → Figma-Nodes“-Renderer** implementieren (rekursiv Frames, Texte, Fills, etc.).

### 3. Was die Repo aktuell liefert

- **Vorhanden und nutzbar:**
  - Chrome-Extension als Referenz (Popup, Background, Inject).
  - Klarheit über den Ablauf: Capture im Tab → `htmlToFigma` → Download `page.figma.json` → manueller Upload im Figma-Plugin.
- **Nicht vorhanden (für euren Einbau relevant):**
  - Quellcode für **HTML → layers** (lib/ fehlt; nur npm-Paket).
  - Quellcode für **layers → Figma** (plugin/ fehlt).

## Optionen für „URL eingeben → Capture → in Figma übertragen“

### A) URL-Eingabe im Figma-Plugin + Backend mit Headless-Browser

- User gibt im Plugin eine URL ein.
- **Backend** (z. B. Node mit Puppeteer/Playwright):
  - lädt die URL,
  - injiziert das **Browser-Bundle** von `@builder.io/html-to-figma` (z. B. `dist/browser.js`),
  - ruft `htmlToFigma(document.body)` (oder mit Frames) auf,
  - liefert das **layers-JSON** an das Plugin zurück.
- **Plugin**:
  - empfängt das layers-JSON,
  - enthält einen **eigenen** „layers → Figma“-Renderer (siehe oben).

Voraussetzung: Layer-Schema von `@builder.io/html-to-figma` verstehen (Typen, Beispiele, evtl. Doku oder Paket-Code).

### B) Chrome-Extension beibehalten, Figma-Plugin nur „Import“

- Geforkte **Chrome-Extension** wie im Repo: User öffnet die gewünschte URL, klickt „Capture“ → Download von `page.figma.json`.
- Eigenes **Figma-Plugin** (z. B. unter Experimental „HTML to Figma“):
  - „Datei auswählen“ oder „Eingefügtes JSON“ (z. B. aus Clipboard),
  - liest das gleiche **layers-JSON**-Format,
  - **eigener Renderer** layers → Figma-Nodes.

Vorteil: Kein Headless nötig; Capture passiert im echten Browser (Login, JS, etc.). Nachteil: Zwei Schritte (Seite im Browser öffnen + im Plugin Datei wählen).

### C) Nur „einfach URL eingeben“ im Plugin (ohne Extension)

- Dann **muss** ein Service die URL laden und das DOM bereitstellen → Variante A (Headless + `@builder.io/html-to-figma` im Browser-Kontext).
- Das Plugin bleibt dann reine UI (URL + Fortschritt/Fehler) und **Import-Renderer** für das vom Backend gelieferte layers-JSON.

## Nächste Schritte für die Implementierung

1. **Layer-Format klären:**  
   `@builder.io/html-to-figma` installieren, in einem kleinen Skript (Browser oder Headless) `htmlToFigma(document.body)` aufrufen und die Struktur von `layers` ausgeben (Typen, Felder, Verschachtelung). Optional: Doku/Issues im Repo oder im npm-Paket prüfen.
2. **„Layers → Figma“-Renderer im Plugin:**  
   Rekursive Funktion, die das geklärte Schema in `FrameNode`, `TextNode`, `RectangleNode` etc. übersetzt und in eurem Plugin (z. B. Experimental „HTML to Figma“) aufrufen.
3. **Capture-Seite:**  
   Entweder (A) Backend mit Headless + injiziertem `htmlToFigma` und Abruf durch das Plugin, oder (B) geforkte Chrome-Extension wie oben, plus Plugin-Import.

Wenn ihr euch für eine Option (A, B oder C) entscheidet, kann die Implementierung darauf aufbauend konkret geplant werden (Endpoints, Nachrichten-Format, Fehlerbehandlung).

---

## Alternative: sergcen/html-to-figma

**Repo:** [sergcen/html-to-figma](https://github.com/sergcen/html-to-figma) („Convert DOM node to Figma node“, inspiriert von BuilderIO/figma-html)

Diese Repo enthält **beide Teile im Quellcode** und eignet sich gut zum Forken/Einbauen.

### Struktur

| Bereich | Inhalt |
|--------|--------|
| **src/browser/** | DOM → Layer-Meta: `html-to-figma.ts`, `element-to-figma.ts`, `build-tree.ts`, `dom-utils.ts`, `text-to-figma.ts`, `border.ts`, `add-constraints.ts`, `utils.ts`. **Export:** `htmlToFigma(element | selector)` → Layer-Struktur (serialisierbar). |
| **src/figma/** | Layer-Meta → Figma-Nodes: `processLayer.ts`, `helpers.ts`, `getFont.ts`, `images.ts`, `dropOffset.ts`. **Export:** `addLayersToFrame(layersMeta, baseFrame, onLayerProcess?)` – erzeugt echte Figma-Nodes. |
| **src/types.ts** | Gemeinsame Typen (`LayerNode`, `PlainLayerNode`, …). |
| **dev-plugin/** | Beispiel-Figma-Plugin: UI (frame.tsx, frame.html), `figma.ts` nutzt `addLayersToFrame`; empfängt per `figma.ui.onmessage` ein `{ type: 'import', data: { layers } }` und fügt die Layers in die aktuelle Seite ein. |
| **tests/** | Jest + Puppeteer, HTML-Stubs, Snapshots. |

### API (README)

```js
// Browser (DOM → serialisierbare Layer)
import { htmlToFigma } from 'html-figma/browser';
const element = document.getElementById('element-to-export');
const layersMeta = await htmlToFigma(element);  // in Repo: htmlToFigma ist sync, ggf. README veraltet

// Figma (Layer → echte Nodes)
import { addLayersToFrame } from 'html-figma/figma';
const rootNode = figma.currentPage;
await addLayersToFrame(layersMeta, rootNode);
```

### Für „URL eingeben → Capture → Figma“

1. **Capture:** Weiterhin nur mit echtem DOM möglich. Entweder (A) Backend mit Headless (Puppeteer/Playwright): URL laden, `html-figma/browser` im Page-Kontext ausführen, `layersMeta` zurück an das Plugin. Oder (B) kleines Capture-Tool (z. B. iframe oder Extension), das die Seite lädt und `htmlToFigma(document.body)` aufruft und das JSON an das Plugin sendet.
2. **Import im Plugin:** Im Figma-Plugin `html-figma` (bzw. nur den Figma-Teil) einbinden und `addLayersToFrame(layersMeta, figma.currentPage)` aufrufen, sobald `layersMeta` vorliegt (z. B. aus PostMessage oder aus Backend-Response).

### Vorteile gegenüber BuilderIO/figma-html

- **Kompletter Quellcode** für Browser- und Figma-Seite im Repo.
- **Figma-Import** ist fertig implementiert (`addLayersToFrame`), kein eigenes Reverse-Engineering nötig.
- **Beispiel-Plugin** (`dev-plugin`) zeigt die Anbindung (Message „import“ + `addLayersToFrame`).
- **Tests** mit Puppeteer und Snapshots für die Browser-Seite.
- **npm:** `html-figma` (Version 0.3.1); package.json hat keine "exports"-Felder für `/browser` und `/figma` – beim Einbau prüfen, ob das Paket diese Pfade bereitstellt oder ob ihr aus dem Fork baut und die Eintrittspunkte selbst setzt.

Hinweis: README kennzeichnet das Projekt als „WORK IN PROGRESS“. Demo-Plugin: [Figma Community – html-to-figma DEV plugin](https://www.figma.com/community/plugin/1005496056687344906/html-to-figma-DEV-plugin).
