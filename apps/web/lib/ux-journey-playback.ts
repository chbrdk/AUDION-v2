/**
 * UX Journey UI tuning (build-time via NEXT_PUBLIC_*).
 * Recording speed is controlled on the agent service (UX_JOURNEY_*_SECONDS env vars).
 */

/**
 * Default HTML5 video playback speed (0.0625–4).
 *
 * Note: the *primary* slow-motion is now applied server-side in the
 * UX-Journey-Agent via ffmpeg `setpts` (env `UX_JOURNEY_VIDEO_SLOWDOWN_FACTOR`,
 * default 8). This frontend rate is a per-viewer fine-tune on top — most
 * deployments leave it at `1` since the saved file is already slow.
 *
 * The lower bound of 0.0625 matches what Chrome/Firefox accept for HTMLVideo.
 * Safari clamps anything < 0.5 to 0.5 silently — that's fine, just means
 * Safari users get the server-side slowdown without further client tweak.
 */
export function getUxJourneyVideoPlaybackRate(): number {
  const raw = process.env.NEXT_PUBLIC_UX_JOURNEY_VIDEO_PLAYBACK_RATE;
  const n = raw != null && raw !== "" ? Number.parseFloat(raw) : 1;
  if (!Number.isFinite(n)) return 1;
  return Math.min(4, Math.max(0.0625, n));
}

/** How often the live preview JPEG is refreshed (ms). Higher = choppier but less traffic. */
export function getUxJourneyLivePollIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_UX_JOURNEY_LIVE_POLL_INTERVAL_MS;
  const n = raw != null && raw !== "" ? Number.parseInt(raw, 10) : 500;
  if (!Number.isFinite(n)) return 500;
  return Math.min(5000, Math.max(200, n));
}
