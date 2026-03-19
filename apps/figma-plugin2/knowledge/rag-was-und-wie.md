# RAG-Design: Was und wie raggen wir?

## Was wird gecrawlt?

### 1. Figma REST API
- **`GET /files/:key/component_sets`** – veröffentlichte Component Sets
- **`GET /files/:key/components`** – veröffentlichte Einzelkomponenten
- **`GET /files/:key/nodes`** (Batches à 30) – Node-Details für Properties/Varianten
- Optional: **`GET /images/:key`** – Thumbnail-URLs (PNG) pro Komponente

### 2. Pro Komponente extrahiert
| Feld | Quelle | Beispiel |
|------|--------|----------|
| `name` | Figma API | `Button`, `Card/Product` |
| `key` | Figma API | `abc123...` |
| `description` | Figma API | Designer-Text (oft leer) |
| `properties` | Node document | `Variant`, `Label`, `Size` etc. |
| `variants` | Node + Component Set | `Primary`, `Secondary`, `Small`, `Large` |
| `searchText` | buildSearchText() + Enrichment | Name + Description + Options + semantic hints + designSystem + aestheticStyle + commonContexts |
| `thumbnailUrl` | Images API | URL zu PNG (optional) |
| `designSystem` | LLM Enrichment | Bootstrap, Porsche Design System, MSQDX, Custom |
| `aestheticStyle` | LLM Enrichment | minimalistisch, corporate, luxury, playful |
| `usageHint` | LLM Enrichment | Primary CTAs, Product teaser cards |
| `commonContexts` | LLM Enrichment | landing, forms, dashboard, hero |

### 3. Semantic Hints (buildSearchText)
Keywords werden ergänzt, z.B.:
- `button` → action, cta, click, submit
- `card` → content, container, teaser, tile
- `input` → field, form, text, entry
- `navbar` → navigation, menu, header, links
- `hero` → banner, headline, above fold, landing
- `footer` → bottom, links, copyright

---

## Wie raggen wir?

### Retrieval (bei Compose)
1. **Vector Search** (wenn `VOYAGE_API_KEY` gesetzt):
   - Prompt → Voyage Embedding
   - `SELECT ... ORDER BY embedding <=> query_vector LIMIT 25`
2. **Keyword Fallback** (wenn kein Voyage oder leere Vector-Result):
   - Prompt-Tokens → OR-Suche auf `search_text`
   - Filler-Wörter werden übersprungen (erstelle, einen, create, add, …)

### Embedding
- **Input:** `searchText` (Name + Description + Options + Varianten + semantic hints)
- **Modell:** Voyage AI (z.B. voyage-3)
- **Speicher:** `component_embeddings` (pgvector)

---

## Was sieht das LLM beim Compose?

### Aktuell im System Prompt
Für jede Komponente erhält Claude:
```
## Button (component_set)
Key: abc123...
Description: (none)
Design System: Bootstrap | Stil: minimalistisch | Einsatz: Primary CTAs | typ. Kontexte: landing, forms
Properties:
  - Variant: BOOLEAN [Primary | Secondary | Outline]
  - Size: VARIANT [Small | Medium | Large]
Variants: Primary Small, Primary Medium, Secondary Small, ...
```

Die Zeile **Design System | Stil | Einsatz | typ. Kontexte** erscheint nur, wenn sie per LLM-Enrichment befüllt sind.

### Was das LLM **nicht** sieht
- Keine Thumbnails/Bilder
- Kein visuelles Verständnis – nur Name, Description, Properties, Variants

### Versteht das LLM wie die Komponenten aussehen?
**Nein.** Das LLM hat ausschließlich:
- Namen wie "Button" oder "Card/Product"
- Description (wenn Designer etwas eingetragen hat)
- Property-/Varianten-Optionen

Es schließt aus Konvention („Button“ = klickbar) und aus der Description. Ein visuelles Modell (Claude Vision, Thumbnails) wird aktuell nicht verwendet.

---

## Komponenten aus Auswahl hinzufügen

Neben dem Crawl der gesamten Library gibt es einen zweiten Weg, Komponenten zum RAG hinzuzufügen:

1. **Im Figma Plugin:** RAG DESIGN → Komponenten oder Instanzen in Figma auswählen
2. **„Auswahl laden“** klicken – die Selection wird traversiert (COMPONENT, COMPONENT_SET, INSTANCE)
3. **Kategorisierungsfelder** ausfüllen (optional): Design System, Stil, Tags/Kontexte, Einsatz
4. **„Zum RAG hinzufügen“** – `POST /api/v1/add-components` mit den Komponenten und Kategorien

**Besserer Ansatz für Varianten:** Statt alle Unterkomponenten/Varianten einzeln auszuwählen und zu crawlen, wird nun automatisch erkannt:

- **Component Set** (z. B. „Button“ mit vielen Varianten): Beim Laden der Auswahl wird **ein** Eintrag pro Set erzeugt. Aus dem Set werden gelesen:
  - `componentPropertyDefinitions` → Properties (VARIANT, BOOLEAN, TEXT, INSTANCE_SWAP) inkl. Optionen
  - Kinder des Sets → jede Variante als `{ name, key, properties }` (z. B. „Size=Small, State=Default“)
  - Optional: Text-Layer-Namen aus der Default-Variante
- Wenn du eine **Instanz** oder eine **einzelne Variante** auswählst, wird automatisch das **gesamte Component Set** (der übergeordnete Set-Knoten) hinzugefügt – mit allen Varianten und Optionen.
- Die Kategorien werden weiterhin als `designSystem`, `aestheticStyle`, `usageHint`, `commonContexts` gespeichert. Properties und Varianten kommen aus der Figma-Plugin-API und werden im Catalog gespeichert, sodass Compose alle Optionen kennt.

**LLM-Ableitung beim Auswahl laden:** Beim Klick auf „Auswahl laden“ ruft das Plugin (nach dem Auslesen der Komponenten) automatisch `POST /api/v1/infer-component-metadata` auf (CREATION). Übergeben werden die Komponentenliste (Name, Typ, Variantenanzahl, ggf. Variantennamen) und optional ein Screenshot des ersten ausgewählten Knotens (Vision). Das Backend nutzt Claude, um daraus **Stil** (aestheticStyle), **Tags** (commonContexts) und **Einsatz** (usageHint) abzuleiten. **Design System wird bewusst nicht abgeleitet** – das bleibt manuell. Die drei Felder Stil, Tags und Einsatz werden im RAG-Panel vorausgefüllt; Nutzer können sie anpassen. Inferenz schlägt fehl oder wird übersprungen, wenn keine RAG-API-URL gesetzt ist oder der Aufruf fehlschlägt – dann erscheinen die Felder leer.

---

## Implementierte Erweiterungen

1. **LLM-Enrichment** – `enrichCatalogWithLLM` nutzt Claude, um pro Komponente zu inferieren:
   - `designSystem`: z.B. Bootstrap, Porsche Design System, MSQDX, Material Design, Tailwind UI, Custom
   - `aestheticStyle`: z.B. minimalistisch, corporate, luxury, playful, industrial, clean, bold
   - `usageHint`: Kurze Empfehlung (z.B. Primary CTAs, Product teaser cards)
   - `commonContexts`: Array von Kontext-Keywords (z.B. landing, forms, dashboard, hero)
2. **usageHint, commonContexts, designSystem, aestheticStyle** – alle im Compose-Prompt integriert
3. **searchText** – enthält nach Enrichment auch designSystem, aestheticStyle, commonContexts für besseren Vector/Keyword-Retrieval

## Mögliche weitere Erweiterungen

1. **Thumbnails ins Prompt** – Claude Vision nutzen, Bild-URLs pro Komponente mitsenden
2. **Bessere Descriptions** – Designer in Figma bitten, Komponenten zu beschreiben
