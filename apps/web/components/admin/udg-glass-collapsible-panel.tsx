"use client";

import { useState } from "react";
import { Box, IconButton } from "@mui/material";
import clsx from "clsx";
import { MaterialSymbol } from "../material-symbol";

export type UdgGlassCollapsiblePanelProps = {
  children: React.ReactNode;
  title?: string;
  defaultExpanded?: boolean;
};

export const UdgGlassCollapsiblePanel = ({
  children,
  title,
  defaultExpanded = true
}: UdgGlassCollapsiblePanelProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    setExpanded((prev) => !prev);
  };

  return (
    <Box
      className={clsx("udg-glass-panel-wrapper", expanded && "--expanded", !expanded && "--collapsed")}
      sx={{
        transition: "width 0.3s ease, min-width 0.3s ease, max-width 0.3s ease",
        overflow: "visible",
        position: "relative",
        display: "flex",
        flexDirection: "column"
      }}
    >
      {/* Toggle Button - rechts oben, über der Trennlinie */}
      <Box
        sx={{
          position: "absolute",
          top: "0.5rem",
          right: "0",
          zIndex: 100,
          display: { xs: "none", md: "flex" },
          justifyContent: "center",
          transform: "translateX(50%)"
        }}
      >
        <IconButton
          onClick={handleToggle}
          sx={{
            color: "var(--color-text-primary)",
            padding: "0.375rem",
            backgroundColor: "var(--color-neutral)",
            border: "1px solid var(--color-theme-accent)",
            width: "28px",
            height: "28px",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            position: "relative",
            zIndex: 100,
            "&:hover": {
              backgroundColor: "rgba(182, 56, 255, 0.1)",
              boxShadow: "0 2px 8px rgba(182, 56, 255, 0.2)"
            },
            transition: "all 0.2s ease"
          }}
          aria-label={expanded ? "Collapse panel" : "Expand panel"}
        >
          <MaterialSymbol 
            icon={expanded ? "chevron_left" : "chevron_right"} 
            fontSize={18} 
          />
        </IconButton>
      </Box>

      {/* Panel Content */}
      <Box
        component="section"
        className="udg-glass-panel"
        sx={{
          opacity: expanded ? 1 : 0,
          visibility: expanded ? "visible" : "hidden",
          transition: "opacity 0.2s ease, visibility 0.2s ease",
          width: "100%",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        {children}
      </Box>

      {/* Collapsed State - nur vertikaler Text */}
      {!expanded && (
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem 0",
            gap: "1rem",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          }}
        >
          {title && (
            <Box
              sx={{
                writingMode: "vertical-rl",
                textOrientation: "mixed",
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "var(--color-text-primary)",
                letterSpacing: "0.15em",
                textTransform: "uppercase"
              }}
            >
              {title}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

