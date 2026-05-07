"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { alpha, Box, Typography, useTheme } from "@mui/material";

import { API_ROUTES } from "../lib/api-routes";
import { getUxJourneyLivePollIntervalMs } from "../lib/ux-journey-playback";

/**
 * Live view of a running ux-journey-agent job.
 *
 * Strategy: prefer the **MJPEG stream** (`/run/{jobId}/live/stream`,
 * `multipart/x-mixed-replace`). Browsers render that natively in `<img>` at
 * the source framerate (~25fps in our setup) so the user actually sees a
 * smooth video of what the persona is doing.
 *
 * When the MJPEG fails — typically while the agent hasn't captured its first
 * frame yet, or when the proxy briefly drops the connection — we transparently
 * fall back to the single-frame JPEG endpoint (`/run/{jobId}/live`) and poll it
 * via fetch+blob URLs. That keeps the panel from showing a broken-image icon
 * (which is what `<img src=…>` would display if the JPEG endpoint replied with
 * a 404 JSON body).
 *
 * The MJPEG path is retried periodically so a short-lived error doesn't pin us
 * on the slower polling fallback for the rest of the run.
 */

const MJPEG_RETRY_MS = 5_000;

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

  // `mjpegEpoch` is appended to the stream URL as a cache-buster whenever we
  // need to re-establish the connection (after an error or a periodic retry).
  const [mjpegEpoch, setMjpegEpoch] = useState(0);
  // `mjpegOk` flips to false on `<img onError>` and back to true when a fresh
  // load succeeds. While false we render the JPEG-polling fallback.
  const [mjpegOk, setMjpegOk] = useState(true);

  const mjpegUrl = `${API_ROUTES.uxJourneyAgentLiveStream(jobId)}?ts=${mjpegEpoch}`;

  // Periodic retry: even if MJPEG is currently working, kick it once every
  // ~5s so transient hiccups don't quietly degrade us into a frozen frame.
  // (We re-fetch the URL but the server keeps yielding the same multipart
  // body, so the rendered image is still continuous from the user's POV.)
  useEffect(() => {
    if (mjpegOk) return; // only retry while we're stuck in fallback mode
    const id = window.setInterval(() => {
      setMjpegEpoch((n) => n + 1);
      setMjpegOk(true);
    }, MJPEG_RETRY_MS);
    return () => window.clearInterval(id);
  }, [mjpegOk]);

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
        position: "relative",
      }}
    >
      {mjpegOk ? (
        <Box
          component="img"
          key={mjpegEpoch}
          src={mjpegUrl}
          alt="Live view"
          onError={() => setMjpegOk(false)}
          sx={{
            width: "100%",
            display: "block",
            objectFit: "contain",
          }}
        />
      ) : (
        <JpegPollFallback jobId={jobId} intervalMs={intervalMs} />
      )}
    </Box>
  );
}

/**
 * Polled single-frame JPEG fallback for environments where the MJPEG stream
 * isn't reachable (proxy strips multipart, agent hasn't booted Playwright yet,
 * etc.). Same blob-url discipline as before so 404 JSON bodies never reach
 * `<img src>`.
 */
function JpegPollFallback({
  jobId,
  intervalMs,
}: {
  jobId: string;
  intervalMs: number;
}) {
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
        if (!res.ok) return;
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
    [],
  );

  if (!displayUrl) {
    return (
      <Typography variant="caption" sx={{ px: 2, py: 3, color: "text.secondary", textAlign: "center" }}>
        Live-Bild wird vorbereitet … (kurz nach Start kann der erste Frame fehlen)
      </Typography>
    );
  }
  return (
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
  );
}
