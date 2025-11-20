export const BRAND_FONT_VARIABLE = "var(--font-noto-sans-jp)";

const FALLBACK_FONT_STACK = [
  '"Noto Sans JP"',
  '"Hiragino Sans"',
  '"Yu Gothic"',
  '"Segoe UI"',
  "system-ui",
  "-apple-system",
  "BlinkMacSystemFont",
  '"Helvetica Neue"',
  "sans-serif"
].join(", ");

export const BRAND_FONT_FAMILY = `${BRAND_FONT_VARIABLE}, ${FALLBACK_FONT_STACK}`;

export const BRAND_LOGO = {
  path: "/assets/@msqdx-logo.svg",
  alt: "MSQDX logo"
} as const;

