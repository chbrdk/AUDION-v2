"use client";

import { Box, Typography } from "@mui/material";

export type TavusSessionConfig = {
  conversation_url?: string;
  conversation_id?: string;
  meeting_token?: string;
  status?: string;
};

type TavusVideoPanelProps = {
  sessionConfig: TavusSessionConfig;
  personaName?: string;
  onError?: (message: string) => void;
};

/**
 * Embeds Tavus CVI (Conversational Video Interface) via iframe.
 * Styled to match Audion MSQDX (glass card, tokens).
 * Uses conversation_url from the Tavus create-conversation API; if meeting_token
 * is present (private room), append ?t=TOKEN to the URL per Tavus docs.
 */
export function TavusVideoPanel({ sessionConfig, personaName, onError }: TavusVideoPanelProps) {
  const url = sessionConfig.conversation_url;
  const token = sessionConfig.meeting_token;

  if (!url) {
    const msg = "No conversation URL from Tavus.";
    onError?.(msg);
    return (
      <Box
        className="msqdx-glass-tavus-video-panel"
        sx={{
          p: 2,
          textAlign: "center",
          borderRadius: "var(--msqdx-radius-3xl)",
          border: "1px solid var(--color-neutral)",
          backgroundColor: "var(--color-primary-white)",
          color: "var(--color-text-primary)",
        }}
      >
        <Typography sx={{ color: "var(--color-text-secondary)" }}>{msg}</Typography>
      </Box>
    );
  }

  const embedUrl = token ? `${url}${url.includes("?") ? "&" : "?"}t=${encodeURIComponent(token)}` : url;

  return (
    <Box
      className="msqdx-glass-tavus-video-panel"
      sx={{
        width: "100%",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        borderRadius: "var(--msqdx-radius-3xl)",
        overflow: "hidden",
        border: "1px solid var(--color-neutral)",
        backgroundColor: "var(--color-primary-white)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}
    >
      {personaName && (
        <Box
          component="span"
          sx={{
            flexShrink: 0,
            display: "block",
            px: 1.5,
            py: 1,
            fontSize: "var(--msqdx-font-size-sm)",
            color: "var(--color-text-secondary)",
            borderBottom: "1px solid var(--color-neutral)",
          }}
        >
          Video call with {personaName}
        </Box>
      )}
      <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
        <iframe
          src={embedUrl}
          title={personaName ? `Tavus video: ${personaName}` : "Tavus video call"}
          allow="camera; microphone; fullscreen; display-capture"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
          }}
        />
      </Box>
    </Box>
  );
}
