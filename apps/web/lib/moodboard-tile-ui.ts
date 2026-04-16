/**
 * Moodboard tile presentation: category-specific overlay copy and responsive grid placement.
 * Keep persona headline/segment in the persona card — overlays here describe the *tile role*.
 */

import type { SxProps, Theme } from "@mui/material/styles";

const MOOD_DE: Record<string, string> = {
  lifestyle: "Stimmung, Orte, Alltag",
  colors: "Palette, Licht, Kontrast",
  textures: "Haptik, Material, Oberfläche",
  people: "Typ, Ausstrahlung, Nähe",
  ui: "Interaktion, Klarheit, Rhythmus",
  typography: "Rhythmus, Stimme, Form",
};

const MOOD_EN: Record<string, string> = {
  lifestyle: "Mood, places, rituals",
  colors: "Palette, light, contrast",
  textures: "Touch, materials, surface",
  people: "Character, presence, warmth",
  ui: "Interaction, clarity, pace",
  typography: "Rhythm, voice, shape",
};

function normCategory(category: string): string {
  return category.trim().toLowerCase();
}

/** Short overlay line for the image (not the persona headline). */
export function moodboardCategoryMoodLine(category: string, locale: "de" | "en" = "de"): string {
  const key = normCategory(category);
  const map = locale === "en" ? MOOD_EN : MOOD_DE;
  return map[key] ?? (locale === "en" ? "Visual inspiration" : "Visuelle Inspiration");
}

function bento8Md(compact: boolean): SxProps<Theme>[] {
  const s = (n: number) => (compact ? Math.round(n * 0.82) : n);
  return [
    { gridColumn: "1 / 8", gridRow: "1 / 4", minHeight: s(280) },
    { gridColumn: "8 / 10", gridRow: "1 / 2", minHeight: s(128) },
    { gridColumn: "10 / 13", gridRow: "1 / 2", minHeight: s(128) },
    { gridColumn: "8 / 10", gridRow: "2 / 3", minHeight: s(128) },
    { gridColumn: "10 / 13", gridRow: "2 / 3", minHeight: s(128) },
    { gridColumn: "1 / 5", gridRow: "4 / 5", minHeight: s(148) },
    { gridColumn: "5 / 9", gridRow: "4 / 5", minHeight: s(148) },
    { gridColumn: "9 / 13", gridRow: "4 / 5", minHeight: s(148) },
  ];
}

function bento8Xs(compact: boolean): SxProps<Theme>[] {
  const s = (n: number) => (compact ? Math.round(n * 0.85) : n);
  return [
    { gridColumn: "1 / -1", minHeight: s(220) },
    { gridColumn: "span 1", minHeight: s(140) },
    { gridColumn: "span 1", minHeight: s(140) },
    { gridColumn: "span 1", minHeight: s(140) },
    { gridColumn: "span 1", minHeight: s(140) },
    { gridColumn: "span 1", minHeight: s(140) },
    { gridColumn: "span 1", minHeight: s(140) },
    { gridColumn: "span 1", minHeight: s(140) },
  ];
}

/**
 * Grid cell placement + min heights. Falls back to a simple hero + mosaic for other tile counts.
 */
export function moodboardTileGridSx(index: number, total: number, opts?: { compact?: boolean }): SxProps<Theme> {
  const compact = Boolean(opts?.compact);
  const s = (n: number) => (compact ? Math.round(n * 0.85) : n);

  if (total === 8 && index < 8) {
    const md = bento8Md(compact);
    const xs = bento8Xs(compact);
    return {
      xs: xs[index]!,
      md: md[index]!,
    } as SxProps<Theme>;
  }

  if (index === 0) {
    return {
      xs: { gridColumn: "1 / -1", minHeight: s(220) },
      // 12-col grid: half-width hero + mosaic of span-3 tiles reads well for many tiles (e.g. Openverse).
      md: { gridColumn: "span 6", gridRow: "span 2", minHeight: s(260) },
    };
  }

  return {
    xs: { gridColumn: "span 1", minHeight: s(140) },
    md: { gridColumn: "span 3", minHeight: s(150) },
  };
}

/** Slight visual rhythm without breaking the glass look. */
export function moodboardTileCardRadius(index: number): number {
  const r = [18, 14, 22, 16, 20, 14, 18, 16];
  return r[index % r.length] ?? 16;
}
