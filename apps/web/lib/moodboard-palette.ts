export type MoodboardPaletteSwatch = {
  hex: string;
  weight?: number;
};

export function normalizePaletteSwatches(raw: unknown): MoodboardPaletteSwatch[] {
  if (!Array.isArray(raw)) return [];
  const out: MoodboardPaletteSwatch[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const hex = (item as { hex?: unknown }).hex;
    if (typeof hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(hex)) continue;
    const weight = (item as { weight?: unknown }).weight;
    out.push({
      hex: hex.toLowerCase(),
      weight: typeof weight === "number" ? weight : undefined,
    });
  }
  return out.slice(0, 8);
}
