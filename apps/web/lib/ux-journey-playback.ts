/**
 * UX Journey UI tuning (build-time via NEXT_PUBLIC_*).
 * Recording speed is controlled on the agent service (UX_JOURNEY_*_SECONDS env vars).
 */

/** Default HTML5 video playback speed (0.25–2). Use e.g. 0.5 for half-speed review. */
export function getUxJourneyVideoPlaybackRate(): number {
  const raw = process.env.NEXT_PUBLIC_UX_JOURNEY_VIDEO_PLAYBACK_RATE;
  const n = raw != null && raw !== "" ? Number.parseFloat(raw) : 1;
  if (!Number.isFinite(n)) return 1;
  return Math.min(2, Math.max(0.25, n));
}

/** How often the live preview JPEG is refreshed (ms). Higher = choppier but less traffic. */
export function getUxJourneyLivePollIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_UX_JOURNEY_LIVE_POLL_INTERVAL_MS;
  const n = raw != null && raw !== "" ? Number.parseInt(raw, 10) : 500;
  if (!Number.isFinite(n)) return 500;
  return Math.min(5000, Math.max(200, n));
}
