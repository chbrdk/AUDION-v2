const PAINT_ARRAY_KEYS = ["fills", "backgrounds"] as const;

export function isImagePaintType(item: unknown): boolean {
    if (!item || typeof item !== "object") return false;
    const t = (item as { type?: unknown }).type;
    return typeof t === "string" && t.toUpperCase() === "IMAGE";
}

/**
 * Collect IMAGE paints from `fills` and `backgrounds` (frames often use backgrounds for CSS-like layer bg).
 */
export function getImagePaintsFromLayer(layer: unknown): any[] {
    if (!layer || typeof layer !== "object") return [];
    const l = layer as Record<string, unknown>;
    const out: any[] = [];
    for (const key of PAINT_ARRAY_KEYS) {
        const arr = l[key];
        if (!Array.isArray(arr)) continue;
        for (const item of arr) {
            if (isImagePaintType(item)) out.push(item);
        }
    }
    return out;
}

/**
 * After `processImages`, or if createImage failed: remove keys Figma rejects on `set_fills` / backgrounds.
 * Drops IMAGE entries that still have no `imageHash` (would fail validation).
 */
export function stripInvalidImageTransportKeys(layer: unknown): void {
    if (!layer || typeof layer !== "object") return;
    const l = layer as Record<string, unknown>;
    for (const key of PAINT_ARRAY_KEYS) {
        const arr = l[key];
        if (!Array.isArray(arr)) continue;
        for (const item of arr) {
            if (!item || typeof item !== "object") continue;
            const p = item as Record<string, unknown>;
            if (!isImagePaintType(p)) continue;
            delete p.base64;
            delete p.intArr;
            delete p.url;
        }
        for (let i = arr.length - 1; i >= 0; i--) {
            const p = arr[i] as Record<string, unknown>;
            if (isImagePaintType(p)) {
                const hash = p.imageHash;
                if (hash == null || hash === "") {
                    arr.splice(i, 1);
                }
            }
        }
    }
}
