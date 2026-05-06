"use client";

import { useEffect, useState } from "react";
import { alpha, Box, useTheme } from "@mui/material";

import { API_ROUTES } from "../lib/api-routes";
import { getUxJourneyLivePollIntervalMs } from "../lib/ux-journey-playback";

/**
 * Polls the single-frame JPEG endpoint (reliable through Next + auth cookies).
 * MJPEG in `<img src>` often breaks behind proxies or without long-lived streams.
 */
export function UxJourneyLivePoll({
  jobId,
  maxWidth = 720,
  intervalMs = getUxJourneyLivePollIntervalMs(),
}: {
  jobId: string;
  maxWidth?: number;
  intervalMs?: number;
}) {
  const theme = useTheme();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  const src = `${API_ROUTES.uxJourneyAgentLiveFrame(jobId)}?ts=${tick}`;

  return (
    <Box
      component="img"
      src={src}
      alt="Live view"
      sx={{
        width: "100%",
        maxWidth,
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
        backgroundColor: alpha(theme.palette.background.paper, 0.35),
        display: "block",
        minHeight: 120,
        objectFit: "contain",
      }}
    />
  );
}
