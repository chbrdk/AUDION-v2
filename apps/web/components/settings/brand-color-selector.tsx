"use client";

import { useState, useEffect } from "react";
import { MsqdxIcon } from "@msqdx/react";
import { useThemeMode } from "../theme-registry";
import { useI18n } from "../i18n/i18n-provider";
import {
  BRAND_COLOR_STORAGE_KEY,
  BRAND_COLOR_DEFAULT,
  applyBrandColorVars,
} from "../../lib/brand-color-utils";

const OPTIONS_META: {
  varName: string;
  preview: string;
  textColor: string;
  optionKey: "purple" | "blue" | "pink" | "orange" | "green" | "yellow" | "grey" | "default";
}[] = [
  { varName: "--color-secondary-dx-purple", preview: "#b638ff", textColor: "#ffffff", optionKey: "purple" },
  { varName: "--color-secondary-dx-blue", preview: "#3b82f6", textColor: "#ffffff", optionKey: "blue" },
  { varName: "--color-secondary-dx-pink", preview: "#f256b6", textColor: "#ffffff", optionKey: "pink" },
  { varName: "--color-secondary-dx-orange", preview: "#ff6a3b", textColor: "#ffffff", optionKey: "orange" },
  { varName: "--color-secondary-dx-green", preview: "#00ca55", textColor: "#000000", optionKey: "green" },
  { varName: "--color-secondary-dx-yellow", preview: "#fef14d", textColor: "#000000", optionKey: "yellow" },
  { varName: "--color-secondary-dx-grey-light", preview: "#d4d2d2", textColor: "#000000", optionKey: "grey" },
  { varName: "--audion-light-border-color", preview: "#0f172a", textColor: "#ffffff", optionKey: "default" },
];

export function BrandColorSelector() {
  const { t } = useI18n();
  const { themeMode } = useThemeMode();
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  const optionsWithLabels = OPTIONS_META.map((opt) => ({
    ...opt,
    label: t(`settingsTheme.options.${opt.optionKey}` as "settingsTheme.options.purple"),
    description: t(`settingsTheme.descriptions.${opt.optionKey}` as "settingsTheme.descriptions.purple"),
  }));

  useEffect(() => {
    const saved = localStorage.getItem(BRAND_COLOR_STORAGE_KEY);
    const colorVar = saved || BRAND_COLOR_DEFAULT;
    setSelectedColor(colorVar);
    applyBrandColorVars(colorVar, themeMode);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const saved = localStorage.getItem(BRAND_COLOR_STORAGE_KEY);
    const colorVar = saved || BRAND_COLOR_DEFAULT;
    applyBrandColorVars(colorVar, themeMode);
  }, [themeMode, mounted]);

  const handleColorSelect = (varName: string) => {
    setSelectedColor(varName);
    localStorage.setItem(BRAND_COLOR_STORAGE_KEY, varName);
    applyBrandColorVars(varName, themeMode);
  };

  if (!mounted) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "1rem",
      }}
    >
      {optionsWithLabels.map((option) => {
        const isSelected = selectedColor === option.varName;
        const textColor = option.textColor;
        const isLight = textColor === "#000000";
        return (
          <button
            key={option.varName}
            onClick={() => handleColorSelect(option.varName)}
            style={{
              padding: "1.5rem",
              borderRadius: "12px",
              border: `2px solid ${
                isSelected
                  ? "var(--color-theme-accent, var(--color-secondary-dx-purple))"
                  : "var(--color-secondary-dx-grey-light-tint)"
              }`,
              backgroundColor: option.preview,
              color: textColor,
              cursor: "pointer",
              transition: "all 0.2s ease",
              position: "relative",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              boxShadow: isSelected
                ? "0 4px 12px rgba(0, 0, 0, 0.15)"
                : "0 2px 4px rgba(0, 0, 0, 0.1)",
              transform: isSelected ? "scale(1.02)" : "scale(1)",
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(0, 0, 0, 0.2)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow =
                  "0 2px 4px rgba(0, 0, 0, 0.1)";
              }
            }}
          >
            {isSelected && (
              <MsqdxIcon
                name="check_circle"
                customSize={24}
                style={{
                  position: "absolute",
                  top: "0.5rem",
                  right: "0.5rem",
                  color: textColor,
                  filter: isLight
                    ? "drop-shadow(0 2px 4px rgba(255, 255, 255, 0.5))"
                    : "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))",
                }}
              />
            )}
            <strong style={{ fontSize: "1rem", fontWeight: 600 }}>
              {option.label}
            </strong>
            <span style={{ fontSize: "0.875rem", opacity: 0.9 }}>
              {option.description}
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                opacity: 0.8,
                fontFamily: "monospace",
                marginTop: "0.25rem",
              }}
            >
              {option.preview}
            </span>
          </button>
        );
      })}
    </div>
  );
}
