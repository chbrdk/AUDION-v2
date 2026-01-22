"use client";

// Disable static generation to prevent prerendering issues with useState/useContext
export const dynamic = 'force-dynamic';

import { useState } from "react";
import { Box, Alert, Typography, Button } from "@mui/material";
import { MaterialSymbol } from "../../../../components/material-symbol";
import { getPersonaBackendBase } from "../../../api/_lib/backend";

export default function SettingsApiDocsPage() {
  const [iframeError, setIframeError] = useState(false);
  const docsUrl = getPersonaBackendBase({ preferPublic: true }) + "/docs";

  return (
    <div className="msqdx-glass-panel">
      <header className="msqdx-glass-detail__header">
        <div>
          <p className="msqdx-glass-eyebrow">API Reference</p>
          <h1 style={{ margin: 0 }}>API Documentation</h1>
          <p className="msqdx-glass-muted" style={{ maxWidth: "640px" }}>
            Interactive API documentation for the Persona Backend. Explore endpoints, test requests, and view response schemas.
          </p>
        </div>
      </header>

      <Box
        sx={{
          width: "100%",
          height: "calc(100vh - 300px)",
          minHeight: "600px",
          marginTop: "2rem",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid rgba(148, 163, 184, 0.3)",
          position: "relative",
          backgroundColor: "var(--color-neutral)",
        }}
      >
        {iframeError ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 2,
              p: 3,
            }}
          >
            <MaterialSymbol icon="error" fontSize={48} style={{ color: "var(--color-error)" }} />
            <Alert severity="error" sx={{ width: "100%", maxWidth: "600px" }}>
              <Typography variant="h6" gutterBottom>
                Failed to load API documentation
              </Typography>
              <Typography variant="body2" gutterBottom>
                The API documentation could not be loaded. Please check if the backend service is running.
              </Typography>
              <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setIframeError(false);
                    // Force iframe reload by changing key
                    window.location.reload();
                  }}
                  startIcon={<MaterialSymbol icon="refresh" fontSize={16} />}
                >
                  Retry
                </Button>
                <Button
                  component="a"
                  href={docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="text"
                  startIcon={<MaterialSymbol icon="open_in_new" fontSize={16} />}
                >
                  Open in new tab
                </Button>
              </Box>
            </Alert>
          </Box>
        ) : (
          <iframe
            src={docsUrl}
            title="API Documentation"
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              display: "block",
            }}
            onError={() => setIframeError(true)}
            onLoad={(e) => {
              // Check if iframe loaded successfully
              try {
                const iframe = e.currentTarget;
                // If we can't access the content, it might be a CORS issue
                // but the iframe might still work
                if (iframe.contentWindow === null) {
                  setIframeError(true);
                }
              } catch (err) {
                // CORS error is expected when trying to access content
                // but the iframe itself might still work, so don't set error
              }
            }}
          />
        )}
      </Box>
    </div>
  );
}

