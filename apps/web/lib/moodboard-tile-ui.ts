/**
 * Moodboard tile presentation: category-specific overlay copy and responsive grid placement.
 * Keep persona headline/segment in the persona card — overlays here describe the *tile role*.
 *
 * Layout rule: **max 3 columns** from `sm` up so tiles stay large enough to read; `xs` uses 2 columns.
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

/** Shared outer grid: max 3 columns ≥ sm, 2 columns on xs. */
export function moodboardGridContainerSx(opts?: { compact?: boolean }): SxProps<Theme> {
  const compact = Boolean(opts?.compact);
  return {
    display: "grid",
    gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)" },
    gridAutoRows: compact ? "minmax(112px, auto)" : "minmax(160px, auto)",
    gap: compact ? 1 : 1.5,
  };
}

/** 3-column “bento” for 8 tiles (typical OpenAI): large hero + sidebar + two full rows. */
function bento8ThreeCol(compact: boolean): SxProps<Theme>[] {
  const s = (n: number) => (compact ? Math.round(n * 0.9) : n);
  return [
    { gridColumn: "1 / 3", gridRow: "1 / 3", minHeight: s(300) },
    { gridColumn: "3 / 4", gridRow: "1 / 2", minHeight: s(148) },
    { gridColumn: "3 / 4", gridRow: "2 / 3", minHeight: s(148) },
    { gridColumn: "1 / 2", gridRow: "3 / 4", minHeight: s(168) },
    { gridColumn: "2 / 3", gridRow: "3 / 4", minHeight: s(168) },
    { gridColumn: "3 / 4", gridRow: "3 / 4", minHeight: s(168) },
    { gridColumn: "1 / 2", gridRow: "4 / 5", minHeight: s(168) },
    { gridColumn: "2 / 3", gridRow: "4 / 5", minHeight: s(168) },
  ];
}

/** 2-column layout on xs (8 tiles): wide hero + pairs. */
function bento8TwoCol(compact: boolean): SxProps<Theme>[] {
  const s = (n: number) => (compact ? Math.round(n * 0.9) : n);
  return [
    { gridColumn: "1 / -1", gridRow: "1 / 3", minHeight: s(220) },
    { gridColumn: "span 1", minHeight: s(150) },
    { gridColumn: "span 1", minHeight: s(150) },
    { gridColumn: "span 1", minHeight: s(150) },
    { gridColumn: "span 1", minHeight: s(150) },
    { gridColumn: "span 1", minHeight: s(150) },
    { gridColumn: "span 1", minHeight: s(150) },
    { gridColumn: "span 1", minHeight: s(150) },
  ];
}

/**
 * Per-tile placement inside `moodboardGridContainerSx` (2 cols xs, 3 cols sm+).
 */
export function moodboardTileGridSx(index: number, total: number, opts?: { compact?: boolean }): SxProps<Theme> {
  const compact = Boolean(opts?.compact);
  const s = (n: number) => (compact ? Math.round(n * 0.92) : n);

  if (total === 8 && index < 8) {
    const smUp = bento8ThreeCol(compact);
    const xsOnly = bento8TwoCol(compact);
    return {
      xs: xsOnly[index]!,
      sm: smUp[index]!,
    } as SxProps<Theme>;
  }

  if (index === 0) {
    return {
      xs: { gridColumn: "1 / -1", gridRow: "span 2", minHeight: s(240) },
      sm: { gridColumn: "1 / 3", gridRow: "span 2", minHeight: s(300) },
    } as SxProps<Theme>;
  }

  return {
    xs: { gridColumn: "span 1", minHeight: s(150) },
    sm: { gridColumn: "span 1", minHeight: s(170) },
  } as SxProps<Theme>;
}

/** Slight visual rhythm without breaking the glass look. */
export function moodboardTileCardRadius(index: number): number {
  const r = [18, 14, 22, 16, 20, 14, 18, 16];
  return r[index % r.length] ?? 16;
}
