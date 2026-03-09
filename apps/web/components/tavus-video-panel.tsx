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
      <Box sx={{ p: 2, textAlign: "center" }}>
        <Typography color="text.secondary">{msg}</Typography>
      </Box>
    );
  }

  const embedUrl = token ? `${url}${url.includes("?") ? "&" : "?"}t=${encodeURIComponent(token)}` : url;

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        minHeight: 400,
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "background.paper",
      }}
    >
      {personaName && (
        <Typography variant="caption" sx={{ display: "block", px: 1, py: 0.5, color: "text.secondary" }}>
          Video call with {personaName}
        </Typography>
      )}
      <iframe
        src={embedUrl}
        title={personaName ? `Tavus video: ${personaName}` : "Tavus video call"}
        allow="camera; microphone; fullscreen; display-capture"
        style={{
          width: "100%",
          height: "100%",
          minHeight: 380,
          border: "none",
        }}
      />
    </Box>
  );
}
