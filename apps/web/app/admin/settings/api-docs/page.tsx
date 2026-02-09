"use client";

// Disable static generation to prevent prerendering issues with useState/useContext
export const dynamic = 'force-dynamic';

import { useState } from "react";
import { Box, Alert, Typography, Button } from "@mui/material";
import { MsqdxIcon } from "@msqdx/react";
import { getPersonaBackendBase } from "../../../api/_lib/backend";
import { useI18n } from "../../../../components/i18n/i18n-provider";

export default function SettingsApiDocsPage() {
  const [iframeError, setIframeError] = useState(false);
  const docsUrl = getPersonaBackendBase({ preferPublic: true }) + "/docs";
  const { t } = useI18n();

  return (
    <div className="msqdx-glass-panel">
      <header className="msqdx-glass-detail__header">
        <div>
          <p className="msqdx-glass-eyebrow">{t("settingsApiDocs.eyebrow")}</p>
          <h1 style={{ margin: 0 }}>{t("settingsApiDocs.title")}</h1>
          <p className="msqdx-glass-muted" style={{ maxWidth: "640px" }}>
            {t("settingsApiDocs.subtitle")}
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
            <MsqdxIcon name="error" customSize={48} style={{ color: "var(--color-error)" }} />
            <Alert severity="error" sx={{ width: "100%", maxWidth: "600px" }}>
              <Typography variant="h6" gutterBottom>
                {t("settingsApiDocs.errorTitle")}
              </Typography>
              <Typography variant="body2" gutterBottom>
                {t("settingsApiDocs.errorBody")}
              </Typography>
              <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setIframeError(false);
                    // Force iframe reload by changing key
                    window.location.reload();
                  }}
                  startIcon={<MsqdxIcon name="refresh" customSize={16} />}
                >
                  {t("settingsApiDocs.retry")}
                </Button>
                <Button
                  component="a"
                  href={docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="text"
                  startIcon={<MsqdxIcon name="open_in_new" customSize={16} />}
                >
                  {t("settingsApiDocs.openNew")}
                </Button>
              </Box>
            </Alert>
          </Box>
        ) : (
          <iframe
            src={docsUrl}
            title={t("settingsApiDocs.iframeTitle")}
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
