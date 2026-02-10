"use client";

import { useEffect, useState } from "react";
import { Box, Stack } from "@mui/material";
import { applyBrandColorVars } from "../../lib/brand-color-utils";

const BRAND_COLORS = [
  { id: "purple", varName: "--color-secondary-dx-purple", hex: "#b638ff" },
  { id: "yellow", varName: "--color-secondary-dx-yellow", hex: "#fef14d" },
  { id: "pink", varName: "--color-secondary-dx-pink", hex: "#f256b6" },
  { id: "orange", varName: "--color-secondary-dx-orange", hex: "#ff6a3b" },
  { id: "green", varName: "--color-secondary-dx-green", hex: "#00ca55" },
] as const;

const STORAGE_KEY = "audion-sidebar-color";
const DEFAULT_COLOR = "--color-secondary-dx-green";

export function AuthBrandColorSelector() {
  const [selected, setSelected] = useState<string>(DEFAULT_COLOR);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_COLOR;
    setSelected(saved);
    applyBrandColorVars(saved, "light");
    setMounted(true);
  }, []);

  const handleSelect = (varName: string) => {
    setSelected(varName);
    localStorage.setItem(STORAGE_KEY, varName);
    applyBrandColorVars(varName, "light");
  };

  if (!mounted) return null;

  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      justifyContent="flex-start"
      sx={{ mt: 3, alignSelf: "flex-start" }}
    >
      {BRAND_COLORS.map(({ id, varName, hex }) => {
        const isSelected = selected === varName;
        return (
          <Box
            key={id}
            component="button"
            type="button"
            onClick={() => handleSelect(varName)}
            aria-label={`Farbe ${id} wählen`}
            aria-pressed={isSelected}
            sx={{
              width: 20,
              height: 40,
              borderRadius: "20px",
              border: `2px solid ${isSelected ? "#fff" : "rgba(255,255,255,0.5)"}`,
              backgroundColor: hex,
              cursor: "pointer",
              padding: 0,
              boxShadow: isSelected
                ? "0 0 0 2px rgba(255,255,255,0.8)"
                : "none",
              transition: "box-shadow 0.2s, border-color 0.2s",
              "&:hover": {
                boxShadow: "0 0 0 2px rgba(255,255,255,0.6)",
              },
              "&:focus-visible": {
                outline: "2px solid white",
                outlineOffset: 2,
              },
            }}
          />
        );
      })}
    </Stack>
  );
}
