"use client";

import { useEffect } from "react";
import { useThemeMode } from "../theme-registry";
import { initBrandColorFromStorage } from "../../lib/brand-color-utils";

/**
 * Initializes brand color from localStorage on mount.
 * Renders nothing. Place in admin layout so the saved color is applied
 * even when user hasn't visited profile/theme settings.
 */
export function BrandColorInitializer() {
  const { themeMode } = useThemeMode();

  useEffect(() => {
    initBrandColorFromStorage(themeMode);
  }, [themeMode]);

  return null;
}
