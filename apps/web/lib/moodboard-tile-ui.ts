/**
 * Moodboard tile presentation: neutral editorial frame — color comes from photos, not UI chrome.
 */

import type { SxProps, Theme } from "@mui/material/styles";

const MOOD_DE: Record<string, string> = {
  lifestyle: "Interesse im echten Moment",
  places: "Räume mit Bedeutung",
  colors: "Licht und Farbe",
  textures: "Material, Fokus, Tiefe",
  people: "Gruppe, Dynamik, Haltung",
  objects: "Das zentrale Objekt",
  ui: "Digitale Ruhe",
  typography: "Form und Rhythmus",
};

const MOOD_EN: Record<string, string> = {
  lifestyle: "Interest in the moment",
  places: "Spaces that matter",
  colors: "Light and color",
  textures: "Material, focus, depth",
  people: "Group, energy, stance",
  objects: "The focal object",
  ui: "Digital calm",
  typography: "Form and rhythm",
};

const CATEGORY_LABEL_DE: Record<string, string> = {
  lifestyle: "Lifestyle",
  places: "Orte",
  colors: "Farben",
  textures: "Texturen",
  people: "Menschen",
  objects: "Objekte",
  ui: "Interface",
  typography: "Typografie",
};

const CATEGORY_LABEL_EN: Record<string, string> = {
  lifestyle: "Lifestyle",
  places: "Places",
  colors: "Colors",
  textures: "Textures",
  people: "People",
  objects: "Objects",
  ui: "Interface",
  typography: "Typography",
};

/** Subtle bottom read — no per-category color wash. */
const EDITORIAL_OVERLAY =
  "linear-gradient(180deg, rgba(0,0,0,0) 38%, rgba(0,0,0,0.35) 72%, rgba(0,0,0,0.78) 100%)";

export type MoodboardCategoryVisual = {
  accent: string;
  accentTint: string;
  glow: string;
  overlay: string;
};

const EDITORIAL_VISUAL: MoodboardCategoryVisual = {
  accent: "var(--color-border-subtle, rgba(0, 0, 0, 0.12))",
  accentTint: "transparent",
  glow: "rgba(0, 0, 0, 0.12)",
  overlay: EDITORIAL_OVERLAY,
};

function normCategory(category: string): string {
  return category.trim().toLowerCase();
}

/** Neutral frame for all categories — imagery carries color. */
export function moodboardCategoryVisual(_category: string): MoodboardCategoryVisual {
  return EDITORIAL_VISUAL;
}

export function moodboardCategoryDisplayLabel(category: string, locale: "de" | "en" = "de"): string {
  const key = normCategory(category);
  const map = locale === "en" ? CATEGORY_LABEL_EN : CATEGORY_LABEL_DE;
  const raw = category.trim();
  return map[key] ?? (raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : locale === "en" ? "Mood" : "Stimmung");
}

export function moodboardCategoryMoodLine(category: string, locale: "de" | "en" = "de"): string {
  const key = normCategory(category);
  const map = locale === "en" ? MOOD_EN : MOOD_DE;
  return map[key] ?? (locale === "en" ? "Visual inspiration" : "Visuelle Inspiration");
}

export function moodboardGridContainerSx(opts?: { compact?: boolean; immersive?: boolean }): SxProps<Theme> {
  const compact = Boolean(opts?.compact);
  const immersive = Boolean(opts?.immersive);
  return {
    display: "grid",
    gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)" },
    gridAutoRows: immersive
      ? "minmax(200px, auto)"
      : compact
        ? "minmax(112px, auto)"
        : "minmax(160px, auto)",
    gap: immersive ? { xs: 1.25, sm: 1.75 } : compact ? 1 : 1.5,
  };
}

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

export function moodboardTileGridSx(
  index: number,
  total: number,
  opts?: { compact?: boolean; immersive?: boolean }
): SxProps<Theme> {
  const compact = Boolean(opts?.compact);
  const immersive = Boolean(opts?.immersive);
  const scale = immersive ? 1.12 : compact ? 0.92 : 1;
  const s = (n: number) => Math.round(n * scale);

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

export function moodboardTileCardRadius(index: number): number {
  const r = [14, 12, 14, 12, 14, 12, 14, 12];
  return r[index % r.length] ?? 12;
}

export function shouldShowMoodboardStrip(moodboard: { status?: string; tiles?: readonly unknown[] } | null): boolean {
  if (!moodboard) return false;
  const status = (moodboard.status ?? "").toLowerCase();
  const hasTiles = (moodboard.tiles?.length ?? 0) > 0;
  return hasTiles || status === "building" || status === "draft" || status === "failed";
}
