"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { createTranslator, DEFAULT_LOCALE, normalizeLocale, type Locale } from "../../lib/i18n";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE_SEC,
  LOCALE_STORAGE_KEY,
} from "../../lib/i18n/locale-storage";

type I18nContextValue = {
  locale: Locale;
  setLocale: (value: Locale | string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const I18nProvider = ({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) => {
  const [locale, setLocaleState] = useState<Locale>(normalizeLocale(initialLocale ?? DEFAULT_LOCALE));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored) {
      setLocaleState(normalizeLocale(stored));
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // ignore storage failures
    }
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SEC}; samesite=lax`;
  }, [locale]);

  const setLocale = (value: Locale | string) => {
    setLocaleState(normalizeLocale(String(value)));
  };

  const t = useMemo(() => createTranslator(locale), [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
};
