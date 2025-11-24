"use client";

import { useState } from "react";
import { Box, Alert, Typography, Button } from "@mui/material";
import { getPersonaBackendBase } from "../../api/_lib/backend";

export default function ApiDocsPage() {
  const [iframeError, setIframeError] = useState(false);
  const docsUrl = getPersonaBackendBase({ preferPublic: true }) + "/docs";

  return (
    <Box
      sx={{
        width: "100%",
        height: "calc(100vh - 200px)",
        minHeight: "600px",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid var(--color-neutral)",
        position: "relative",
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
          <Alert severity="error" sx={{ width: "100%", maxWidth: "600px" }}>
            <Typography variant="h6" gutterBottom>
              Failed to load API documentation
            </Typography>
            <Typography variant="body2" gutterBottom>
              The API documentation could not be loaded. Please check if the backend service is running.
            </Typography>
            <Button
              variant="outlined"
              onClick={() => {
                setIframeError(false);
                // Force iframe reload by changing key
                window.location.reload();
              }}
              sx={{ mt: 2 }}
            >
              Retry
            </Button>
            <Button
              component="a"
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="text"
              sx={{ mt: 1 }}
            >
              Open in new tab
            </Button>
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
  );
}

