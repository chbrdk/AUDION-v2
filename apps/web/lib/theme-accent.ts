/**
 * CSS-Variablen für User-wählbare Brand-Farbe.
 * Wird von applyBrandColorVars() gesetzt. Verwendung statt hardcodierter BRAND_COLOR.
 */
export const THEME_ACCENT = {
  color: "var(--color-theme-accent)",
  borderColor: "var(--color-theme-accent)",
  backgroundColor: "var(--color-theme-accent)",
} as const;

/** Fallback wenn CSS-Variable noch nicht gesetzt */
export const THEME_ACCENT_WITH_FALLBACK = {
  color: "var(--color-theme-accent, var(--color-secondary-dx-green))",
  borderColor: "var(--color-theme-accent, var(--color-secondary-dx-green))",
  backgroundColor: "var(--color-theme-accent, var(--color-secondary-dx-green))",
} as const;

/** sx für Divider mit Theme-Akzent (borderColor für .msqdx-divider-line) */
export const DIVIDER_ACCENT_SX = {
  "& .msqdx-divider-line": { borderColor: "var(--color-theme-accent) !important" },
} as const;

/** sx für MsqdxInput (msqdx-input-wrapper) mit Theme-Akzent */
export const INPUT_ACCENT_SX = {
  "& .msqdx-input-wrapper": {
    borderColor: "var(--color-theme-accent) !important",
    "&:hover": { borderColor: "var(--color-theme-accent) !important" },
    "&.focused": { borderColor: "var(--color-theme-accent) !important" },
  },
} as const;

/** sx für FormField/Input-Borders mit Theme-Akzent */
export const FORM_FIELD_ACCENT_SX = {
  "& .MuiOutlinedInput-root": {
    borderColor: "var(--color-theme-accent) !important",
    "&:hover": { borderColor: "var(--color-theme-accent) !important" },
    "&.Mui-focused": { borderColor: "var(--color-theme-accent) !important" },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: "var(--color-theme-accent) !important",
    },
  },
} as const;
