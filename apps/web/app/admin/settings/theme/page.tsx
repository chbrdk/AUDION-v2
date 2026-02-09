"use client";

// Disable static generation to prevent prerendering issues with useState/useContext
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { MsqdxIcon } from "@msqdx/react";
import { useThemeMode } from "../../../../components/theme-registry";
import { useI18n } from "../../../../components/i18n/i18n-provider";

// Helper function to determine if a color is light (needs dark text)
const isLightColor = (hex: string): boolean => {
  // Remove # if present
  const color = hex.replace("#", "");
  // Convert to RGB
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // Return true if luminance is greater than 0.5 (light color)
  return luminance > 0.5;
};

// Mapping für Tint-Versionen der Farben
const COLOR_TINT_MAP: Record<string, string> = {
  "--color-secondary-dx-purple": "--color-secondary-dx-purple-tint",
  "--color-secondary-dx-blue": "--color-secondary-dx-blue-tint",
  "--color-secondary-dx-pink": "--color-secondary-dx-pink-tint",
  "--color-secondary-dx-orange": "--color-secondary-dx-orange-tint",
  "--color-secondary-dx-green": "--color-secondary-dx-green-tint",
  "--color-secondary-dx-yellow": "--color-secondary-dx-yellow-tint",
  "--color-secondary-dx-grey-light": "--color-secondary-dx-grey-light-tint",
  "--audion-light-border-color": "--color-secondary-dx-purple-tint", // Fallback für default
};

export default function ThemeSettingsPage() {
  const { themeMode } = useThemeMode();
  const { t } = useI18n();
  const SIDEBAR_COLOR_OPTIONS = [
    { 
      varName: "--color-secondary-dx-purple", 
      label: t("settingsTheme.options.purple"), 
      preview: "#b638ff",
      description: t("settingsTheme.descriptions.purple"),
      textColor: "#ffffff"
    },
    { 
      varName: "--color-secondary-dx-blue", 
      label: t("settingsTheme.options.blue"), 
      preview: "#3b82f6",
      description: t("settingsTheme.descriptions.blue"),
      textColor: "#ffffff"
    },
    { 
      varName: "--color-secondary-dx-pink", 
      label: t("settingsTheme.options.pink"), 
      preview: "#f256b6",
      description: t("settingsTheme.descriptions.pink"),
      textColor: "#ffffff"
    },
    { 
      varName: "--color-secondary-dx-orange", 
      label: t("settingsTheme.options.orange"), 
      preview: "#ff6a3b",
      description: t("settingsTheme.descriptions.orange"),
      textColor: "#ffffff"
    },
    { 
      varName: "--color-secondary-dx-green", 
      label: t("settingsTheme.options.green"), 
      preview: "#00ca55",
      description: t("settingsTheme.descriptions.green"),
      textColor: "#000000"
    },
    { 
      varName: "--color-secondary-dx-yellow", 
      label: t("settingsTheme.options.yellow"), 
      preview: "#fef14d",
      description: t("settingsTheme.descriptions.yellow"),
      textColor: "#000000"
    },
    { 
      varName: "--color-secondary-dx-grey-light", 
      label: t("settingsTheme.options.grey"), 
      preview: "#d4d2d2",
      description: t("settingsTheme.descriptions.grey"),
      textColor: "#000000"
    },
    { 
      varName: "--audion-light-border-color", 
      label: t("settingsTheme.options.default"), 
      preview: "#0f172a",
      description: t("settingsTheme.descriptions.default"),
      textColor: "#ffffff"
    }
  ];
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load saved preference
    const saved = localStorage.getItem("audion-sidebar-color");
    const colorVar = saved || "--color-secondary-dx-purple";
    setSelectedColor(colorVar);
    
    // Apply saved color and text color on mount
    const styles = getComputedStyle(document.documentElement);
    const resolvedColor = styles.getPropertyValue(colorVar).trim() || 
      (colorVar === "--audion-light-border-color" ? "#0f172a" : "");
    
    if (resolvedColor) {
      document.documentElement.style.setProperty("--audion-light-border-color", resolvedColor);
      document.documentElement.style.setProperty("--audion-light-html-background-color", resolvedColor);
      
      // In light theme, always use black text for sidebar
      const textColor = themeMode === "light" ? "#000000" : (SIDEBAR_COLOR_OPTIONS.find(opt => opt.varName === colorVar)?.textColor || "#ffffff");
      document.documentElement.style.setProperty("--audion-sidebar-text-color", textColor);
      
      // Set theme accent color
      document.documentElement.style.setProperty("--color-theme-accent", `var(${colorVar})`);
      
      // Set theme accent tint
      const tintVar = COLOR_TINT_MAP[colorVar] || "--color-secondary-dx-purple-tint";
      document.documentElement.style.setProperty("--color-theme-accent-tint", `var(${tintVar})`);
    }
    
    setMounted(true);
  }, []);

  // Update text color when theme mode changes
  useEffect(() => {
    if (!mounted) return;
    
    const saved = localStorage.getItem("audion-sidebar-color");
    const colorVar = saved || "--color-secondary-dx-purple";
    
    // In light theme, always use black text for sidebar
    const textColor = themeMode === "light" ? "#000000" : (SIDEBAR_COLOR_OPTIONS.find(opt => opt.varName === colorVar)?.textColor || "#ffffff");
    document.documentElement.style.setProperty("--audion-sidebar-text-color", textColor);
  }, [themeMode, mounted]);

  const handleColorSelect = (varName: string) => {
    setSelectedColor(varName);
    localStorage.setItem("audion-sidebar-color", varName);
    
    // Apply immediately
    const styles = getComputedStyle(document.documentElement);
    const resolvedColor = styles.getPropertyValue(varName).trim() || 
      (varName === "--audion-light-border-color" ? "#0f172a" : "");
    
    if (resolvedColor) {
      document.documentElement.style.setProperty("--audion-light-border-color", resolvedColor);
      document.documentElement.style.setProperty("--audion-light-html-background-color", resolvedColor);
      
        // In light theme, always use black text for sidebar
        const textColor = themeMode === "light" ? "#000000" : (SIDEBAR_COLOR_OPTIONS.find(opt => opt.varName === varName)?.textColor || "#ffffff");
      document.documentElement.style.setProperty("--audion-sidebar-text-color", textColor);
      
      // Set theme accent color (used for borders, accents, etc.)
      document.documentElement.style.setProperty("--color-theme-accent", `var(${varName})`);
      
      // Set theme accent tint
      const tintVar = COLOR_TINT_MAP[varName] || "--color-secondary-dx-purple-tint";
      document.documentElement.style.setProperty("--color-theme-accent-tint", `var(${tintVar})`);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="msqdx-glass-panel">
      <header className="msqdx-glass-detail__header">
        <div>
          <p className="msqdx-glass-eyebrow">{t("settingsTheme.eyebrow")}</p>
          <h1 style={{ margin: 0 }}>{t("settingsTheme.title")}</h1>
          <p className="msqdx-glass-muted" style={{ maxWidth: "640px" }}>
            {t("settingsTheme.subtitle")}
          </p>
        </div>
      </header>

      <div style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
          {t("settingsTheme.sidebarTitle")}
        </h2>
        <p className="msqdx-glass-muted" style={{ marginBottom: "1.5rem" }}>
          {t("settingsTheme.sidebarSubtitle")}
        </p>

        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", 
          gap: "1rem" 
        }}>
          {SIDEBAR_COLOR_OPTIONS.map((option) => {
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
                  border: `2px solid ${isSelected ? "var(--color-theme-accent, var(--color-secondary-dx-purple))" : "var(--color-secondary-dx-grey-light-tint)"}`,
                  backgroundColor: option.preview,
                  color: textColor,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  position: "relative",
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  boxShadow: isSelected ? "0 4px 12px rgba(0, 0, 0, 0.15)" : "0 2px 4px rgba(0, 0, 0, 0.1)",
                  transform: isSelected ? "scale(1.02)" : "scale(1)",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.transform = "scale(1.05)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.2)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
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
                      filter: isLight ? "drop-shadow(0 2px 4px rgba(255, 255, 255, 0.5))" : "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))"
                    }} 
                  />
                )}
                <strong style={{ fontSize: "1rem", fontWeight: 600 }}>
                  {option.label}
                </strong>
                <span style={{ fontSize: "0.875rem", opacity: 0.9 }}>
                  {option.description}
                </span>
                <span style={{ 
                  fontSize: "0.75rem", 
                  opacity: 0.8,
                  fontFamily: "monospace",
                  marginTop: "0.25rem"
                }}>
                  {option.preview}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
