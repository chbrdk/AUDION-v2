"use client";

import { useEffect } from "react";
import { useAuth } from "../auth/auth-provider";
import { useI18n } from "./i18n-provider";
import { normalizeLocale } from "../../lib/i18n";

export const AuthLocaleSync = () => {
  const { user, loading } = useAuth();
  const { setLocale } = useI18n();

  useEffect(() => {
    if (loading || !user?.locale) return;
    setLocale(normalizeLocale(user.locale));
  }, [loading, user?.locale, setLocale]);

  return null;
};
