"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { alpha, Box, Typography, useTheme } from "@mui/material";

import { API_ROUTES } from "../lib/api-routes";
import { getUxJourneyLivePollIntervalMs } from "../lib/ux-journey-playback";

/**
 * Polls the single-frame JPEG endpoint with `fetch` + blob URLs so 404/JSON error bodies
 * never get assigned to `<img src>` (which would show a broken image).
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
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  const replaceUrl = useCallback((next: string | null) => {
    const prev = urlRef.current;
    urlRef.current = next;
    if (prev) URL.revokeObjectURL(prev);
    setDisplayUrl(next);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  useEffect(() => {
    let cancelled = false;
    const url = `${API_ROUTES.uxJourneyAgentLiveFrame(jobId)}?ts=${tick}`;

    (async () => {
      try {
        const res = await fetch(url, {
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "image/jpeg,image/*;q=0.8,*/*;q=0.1" },
        });
        if (cancelled) return;
        if (!res.ok) {
          // 404 until first frame is normal — keep last good image
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        if (!blob.type.startsWith("image/")) return;
        const objectUrl = URL.createObjectURL(blob);
        replaceUrl(objectUrl);
      } catch {
        // network blip — keep last frame
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId, tick, replaceUrl]);

  useEffect(
    () => () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    },
    []
  );

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth,
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
        backgroundColor: alpha(theme.palette.background.paper, 0.35),
        minHeight: 120,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {displayUrl ? (
        <Box
          component="img"
          src={displayUrl}
          alt="Live view"
          sx={{
            width: "100%",
            display: "block",
            objectFit: "contain",
          }}
        />
      ) : (
        <Typography variant="caption" sx={{ px: 2, py: 3, color: "text.secondary", textAlign: "center" }}>
          Live-Bild wird vorbereitet … (kurz nach Start kann der erste Frame fehlen)
        </Typography>
      )}
    </Box>
  );
}
