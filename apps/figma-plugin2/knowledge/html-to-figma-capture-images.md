# HTML-to-Figma: Bilder (CREATION + Plugin)

## Plugin: Reihenfolge in `processLayer`

`processImages(layer)` muss **vor** `assign(node, layer)` laufen (siehe `src/html-figma/figma/processLayer.ts`).

Grund: `assign` kopiert `fills` auf den Figma-Node. Wenn die IMAGE-Paints noch `imageHash: null` und nur `base64` haben, übernimmt Figma diesen Zustand. Späteres Setzen von `imageHash` auf dem **Layer-JSON-Objekt** ändert den **bereits geschriebenen** Node nicht.

**Alle Typen mit `fills`:** Nicht nur `RECTANGLE`, sondern z. B. **FRAME** (Hintergrundbilder) können IMAGE-Fills mit `base64` tragen. Figma wirft sonst: *unrecognized key(s) in object: 'base64'*. Daher `processImages` für jedes `SIMPLE_TYPES`-Layer und für `TEXT` vor `assign` (immer `await processImages`).

**`backgrounds`:** Frames können Bilder in **`backgrounds`** statt in **`fills`** haben. `getImagePaintsFromLayer` / `getImageFills` sammeln beides. CREATION `resolveImageFills` ersetzt URLs auch in `backgrounds`.

**Absicherung:** `stripInvalidImageTransportKeys` (Ende von `processImages`) entfernt `base64`/`url`/`intArr` und **entfernt IMAGE-Paints ohne `imageHash`**, damit `assign` nicht mehr an unbekannten Keys scheitert.

**„Too many font adjustments“:** Diese Meldung gibt es im **aktuellen Quellcode nicht mehr** (ersetzt durch `fitTextWidthForMaxHeight`). Wenn sie noch erscheint, läuft eine **alte gebaute Plugin-Version** – `npm run build` und Plugin in Figma neu importieren.

## Backend (CREATION)

- `resolveImageFills`: `url` → `fetch` oder data-URL → `base64`, `url` entfernen.
- Data-URLs mit `charset=…;base64,` werden unterstützt.
- Fetch sendet einen Browser-ähnlichen `User-Agent`.

## Plugin: Bytes

- `base64` → `base64ToUint8Array` → `figma.createImage`.
- `intArr` nach JSON kann ein normales `number[]` sein → `new Uint8Array(intArr)` in `images.ts`.

## Plugin: Text-Höhe / „Too many font adjustments“

Die alte Schleife in `processLayer.ts` hat die Textbreite nur **5× um 1px** vergrößert, wenn `text.height > layer.height` – bei längeren Texten reicht das nicht. Ersetzt durch **`fitTextWidthForMaxHeight`** (`fit-text-width.ts`): exponentiell eine obere Breitengrenze finden, dann **binäre Suche** auf minimale passende Breite (bis `maxWidth` 8192, Toleranz für Rundung).
