"use client";

import { useState, useEffect } from "react";
import { Box, IconButton, useTheme, useMediaQuery } from "@mui/material";
import clsx from "clsx";
import { MaterialSymbol } from "../material-symbol";
import { useAdminPanel } from "./udg-glass-admin-layout";

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
  const [mounted, setMounted] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md")); // < 960px
  // Get panel state from context (for mobile off-canvas)
  const { panelOpen, setPanelOpen } = useAdminPanel();

  useEffect(() => {
    setMounted(true);
  }, []);

  // On mobile, default to collapsed if not explicitly set
  useEffect(() => {
    if (mounted && isMobile && defaultExpanded === undefined) {
      setExpanded(false);
    }
  }, [mounted, isMobile, defaultExpanded]);

  const handleToggle = () => {
    setExpanded((prev) => !prev);
  };

  const handleMobileClose = () => {
    setPanelOpen(false);
  };

  return (
    <>
      {/* Mobile: Off-Canvas Drawer (slides from left) */}
      {mounted && isMobile && (
        <Box
          component="aside"
          className="udg-glass-panel-wrapper"
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            height: "100vh",
            width: "95%",
            maxWidth: "400px",
            backgroundColor: "var(--color-neutral)",
            borderRight: "1px solid var(--audion-light-border-color, #0f172a)",
            transform: panelOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.3s ease",
            zIndex: 1200,
            overflowY: "auto",
            overflowX: "hidden",
            display: "flex",
            flexDirection: "column"
          }}
        >
          {/* Close Button - Top Right */}
          {title && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1rem",
                borderBottom: "1px solid var(--color-theme-accent)"
              }}
            >
              <Box
                sx={{
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}
              >
                {title}
              </Box>
              <IconButton
                onClick={handleMobileClose}
                sx={{
                  color: "var(--color-text-primary)",
                  padding: "0.5rem",
                  "&:hover": {
                    backgroundColor: "rgba(182, 56, 255, 0.1)"
                  },
                  transition: "all 0.2s ease"
                }}
                aria-label="Close panel"
              >
                <MaterialSymbol icon="close" fontSize={24} />
              </IconButton>
            </Box>
          )}

          {/* Panel Content */}
          <Box
            component="section"
            className="udg-glass-panel"
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "1rem",
              overflowY: "auto"
            }}
          >
            {children}
          </Box>
        </Box>
      )}

      {/* Desktop: Panel Wrapper (hidden on mobile) */}
      <Box
        className={clsx("udg-glass-panel-wrapper", expanded && "--expanded", !expanded && "--collapsed")}
        sx={{
          transition: "width 0.3s ease, min-width 0.3s ease, max-width 0.3s ease",
          overflow: "visible",
          position: "relative",
          display: { xs: "none", md: "flex" }, // Hide on mobile
          flexDirection: "column",
          width: expanded ? "280px" : "64px",
          minWidth: expanded ? "280px" : "64px",
          maxWidth: expanded ? "280px" : "64px"
        }}
      >
      {/* Desktop: Toggle Button - rechts oben, über der Trennlinie */}
      {mounted && (
        <Box
          sx={{
            position: "absolute",
            top: "0.5rem",
            right: "0",
            zIndex: 100,
            display: "flex",
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
      )}

      {/* Desktop: Panel Content */}
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

      {/* Desktop: Collapsed State - nur vertikaler Text */}
      {mounted && !expanded && (
        <Box
          sx={{
            display: "flex",
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
    </>
  );
};

