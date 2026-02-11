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

const THEME_ACCENT_VAR = "var(--color-theme-accent)";
const THEME_ACCENT_OR_GREEN = "var(--color-theme-accent, var(--color-secondary-dx-green))";

/** sx für MsqdxInput (msqdx-input-wrapper) mit Theme-Akzent */
export const INPUT_ACCENT_SX = {
  "& .msqdx-input-wrapper": {
    borderColor: `${THEME_ACCENT_VAR} !important`,
    "&:hover": { borderColor: `${THEME_ACCENT_VAR} !important` },
    "&.focused": { borderColor: `${THEME_ACCENT_VAR} !important` },
  },
  "& .msqdx-input-label": {
    color: "var(--color-input-label, var(--color-theme-accent)) !important",
  },
} as const;

/** Wie INPUT_ACCENT_SX, mit Fallback auf Grün wenn Theme-Akzent nicht gesetzt (z. B. Share-Chat). */
export const INPUT_ACCENT_SX_WITH_FALLBACK = {
  "& .msqdx-input-wrapper": {
    borderColor: `${THEME_ACCENT_OR_GREEN} !important`,
    "&:hover": { borderColor: `${THEME_ACCENT_OR_GREEN} !important` },
    "&.focused": { borderColor: `${THEME_ACCENT_OR_GREEN} !important` },
  },
  "& .msqdx-input-label": {
    color: `var(--color-input-label, ${THEME_ACCENT_OR_GREEN}) !important`,
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
  "& .MuiInputLabel-root": {
    color: "var(--color-input-label, var(--color-theme-accent)) !important",
  },
  "& .MuiInputLabel-root.Mui-focused": {
    color: "var(--color-input-label, var(--color-theme-accent)) !important",
  },
} as const;
