# RAG Embedding: Component Sets und Varianten

## Problem

Eine Figma-Komponente „Button“ kann intern viele Varianten haben (Size=Small/Medium/Large, State=Default/Hover, etc.). Bisher wurde oft nur eine Variante oder eine flache Liste von Unterkomponenten erfasst – das RAG wusste nicht, dass alle zu einem Set mit Optionen gehören.

## Zwei Wege, Komponenten zu indexieren

### 1. Crawl (ganze Datei)

- **CREATION** ruft die Figma REST API auf: `getFileComponentSets`, `getFileComponents`, `getFileNodes`.
- **Component Sets** werden explizit erkannt: Für jedes Set werden Properties und Varianten aus der API extrahiert (`extractPropertyDefinitions`, `extractVariantCombinations`).
- **Standalone Components** (ohne übergeordnetes Set) werden einzeln mit ihren Properties gespeichert.
- Empfohlen, wenn die ganze Library einmalig oder per Scheduler indexiert werden soll.

### 2. Add Components (Auswahl im Plugin)

- **Plugin** (`rag-selection-service.ts`) traversiert die aktuelle Figma-Auswahl.
- **COMPONENT_SET**: Es wird **ein** Eintrag pro Set erzeugt:
  - `componentPropertyDefinitions` (Figma Plugin API) → `properties` (VARIANT mit options, BOOLEAN, TEXT, INSTANCE_SWAP).
  - Kinder des Sets (alle Varianten-Komponenten) → `variants` mit geparsten Properties (z. B. `Size=Small, State=Default`).
  - Optional: Text-Layer-Namen aus der Default-Variante → `textLayers`.
- **COMPONENT** mit Parent COMPONENT_SET: Es wird **nicht** die Einzelkomponente, sondern das **gesamte Set** hinzugefügt (damit alle Varianten im Catalog landen).
- **INSTANCE**: Es wird das zugehörige Main Component bzw. das übergeordnete Component Set hinzugefügt.
- **Backend** (`add-components`): Akzeptiert optional `properties`, `variants`, `variantCount`, `textLayers` und speichert sie im Catalog (wie beim Crawl).

## Empfehlung

- **Eine Hauptkomponente (z. B. Button) mit vielen Varianten:** Einmal das **Component Set** in Figma auswählen (oder eine beliebige Instanz/Variante davon) → „Auswahl laden“ → „Zum RAG hinzufügen“. Es wird genau **ein** Catalog-Eintrag „Button“ mit allen Varianten und Properties angelegt.
- Nicht mehr nötig: Alle Untervarianten manuell auswählen und einzeln hinzufügen.

## Debug: Erkennung prüfen

- **Plugin-Konsole:** Nach „Auswahl laden“ in Figma: **Plugins → Development → Open console** (oder Rechtsklick auf Plugin → „Open console“). Dort erscheinen Log-Zeilen `[RAG] Components loaded: N` und pro Component Set z. B. `[SET] Button: 12 variants, properties: Size: [Small, Medium, Large], State: [Default, Hover]` sowie die ersten Variantennamen.
- **UI:** Im RAG DESIGN Panel unter der Liste der geladenen Komponenten gibt es einen klappbaren Bereich **„Erkennung prüfen (Debug)“**. Darin siehst du pro Eintrag: Name, Typ (component_set/component), Anzahl Varianten, alle erkannten Properties inkl. Optionen, Beispiel-Variantennamen und (falls vorhanden) Text-Layer. So kannst du ohne Konsole prüfen, ob Sets korrekt mit allen Varianten und Optionen erkannt wurden.

## Relevante Dateien

- **Plugin:** `src/services/rag-selection-service.ts` (getRAGComponentsFromSelection, extractPropertiesFromSet, extractVariantsFromSet)
- **Plugin API:** `src/api/rag-compose-client.ts` (AddComponentItem mit properties, variants, variantCount, textLayers)
- **Backend:** `src/routes/add-components.ts` (AddComponentInput erweitert, buildSearchText mit properties/variants/textLayers)
- **Backend Crawl:** `src/crawler/pipeline.ts`, `src/crawler/extractors.ts` (extractVariantCombinations, extractPropertyDefinitions)
- **Debug-Log:** `src/code.ts` (case 'get-rag-components': console.log); **Debug-UI:** `src/components/RAGDesignPanel.tsx` (details „Erkennung prüfen“)
