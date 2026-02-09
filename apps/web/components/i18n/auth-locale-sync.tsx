"use client";

import { useEffect } from "react";
import { useAuth } from "../auth/auth-provider";
import { useI18n } from "./i18n-provider";
import { normalizeLocale } from "../../lib/i18n";

export const AuthLocaleSync = () => {
  const { user } = useAuth();
  const { locale, setLocale } = useI18n();

  useEffect(() => {
    if (!user?.locale) return;
    const nextLocale = normalizeLocale(user.locale);
    if (nextLocale !== locale) {
      setLocale(nextLocale);
    }
  }, [user?.locale, locale, setLocale]);

  return null;
};
