import en from "../../locales/en.json";
import de from "../../locales/de.json";

export type Locale = "en" | "de";

export const DEFAULT_LOCALE: Locale = "en";
export const SUPPORTED_LOCALES: Locale[] = ["en", "de"];

const dictionaries: Record<Locale, Record<string, any>> = {
  en,
  de,
};

const getNestedValue = (source: Record<string, any> | undefined, path: string) => {
  if (!source) return undefined;
  return path.split(".").reduce<any>((acc, key) => (acc && key in acc ? acc[key] : undefined), source);
};

const interpolate = (value: string, params?: Record<string, string | number>) => {
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      return String(params[key]);
    }
    return match;
  });
};

export const normalizeLocale = (value?: string | null): Locale => {
  if (!value) return DEFAULT_LOCALE;
  const lower = value.toLowerCase();
  if (lower.startsWith("de")) return "de";
  return "en";
};

export const resolveLocale = (cookieLocale?: string | null, acceptLanguage?: string | null): Locale => {
  if (cookieLocale) return normalizeLocale(cookieLocale);
  if (acceptLanguage) {
    const primary = acceptLanguage.split(",")[0]?.trim();
    if (primary) {
      return normalizeLocale(primary);
    }
  }
  return DEFAULT_LOCALE;
};

export const createTranslator = (locale: Locale) => {
  const dictionary = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
  return (key: string, params?: Record<string, string | number>) => {
    const raw =
      getNestedValue(dictionary, key) ??
      getNestedValue(dictionaries[DEFAULT_LOCALE], key) ??
      key;
    return interpolate(String(raw), params);
  };
};

export const getDictionary = (locale: Locale) => dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
