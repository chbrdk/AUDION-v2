"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";
import { MsqdxButton, MsqdxCard, MsqdxFormField, MsqdxTypography } from "@msqdx/react";

import { API_ROUTES, withNextBasePath } from "../../../lib/api-routes";
import { getUxJourneyVideoPlaybackRate } from "../../../lib/ux-journey-playback";
import { ChatMessageMarkdown } from "../../../components/chat/chat-message-markdown";
import { normalizeReasoningText } from "../../../lib/normalize-reasoning-text";
import { useI18n } from "../../../components/i18n/i18n-provider";

type Status = "idle" | "running" | "complete" | "error";

type AgentStep = {
  step?: number;
  action?: string;
  target?: string | null;
  result?: string | null;
  reasoning?: string | null;
  screenshot?: string | null;
  screenshotUrl?: string | null;
  timestamp?: string;
};

function uxJourneyStepShotSrc(s: AgentStep): string | null {
  if (s.screenshot?.trim()) return s.screenshot;
  if (s.screenshotUrl?.trim().startsWith("/")) return withNextBasePath(`/api/ux-journey-agent${s.screenshotUrl}`);
  return null;
}

type AgentRunResponse = {
  status?: string;
  jobId?: string;
  result?: {
    steps?: AgentStep[];
    success?: boolean;
    taskDescription?: string;
    siteDomain?: string;
    videoUrl?: string;
  };
  error?: string;
};

export default function UxJourneyAgentAdminPage() {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [task, setTask] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentRunResponse | null>(null);
  const [starting, setStarting] = useState(false);
  const [videoRevealed, setVideoRevealed] = useState(false);
  const [videoFinalizeBusy, setVideoFinalizeBusy] = useState(false);
  const [videoFinalizeError, setVideoFinalizeError] = useState<string | null>(null);
  const [videoPolishFailed, setVideoPolishFailed] = useState(false);
  const [videoCacheKey, setVideoCacheKey] = useState(1);

  const steps = useMemo(() => result?.result?.steps ?? [], [result?.result?.steps]);

  const start = useCallback(async () => {
    setError(null);
    setResult(null);
    setStarting(true);
    try {
      const res = await fetch(API_ROUTES.uxJourneyAgentRun, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), task: task.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { jobId?: string; error?: string; detail?: string };
      if (!res.ok || !data.jobId) {
        setStatus("error");
        setError(data.detail || data.error || "Failed to start run");
        return;
      }
      setJobId(data.jobId);
      setStatus("running");
      setVideoRevealed(false);
      setVideoFinalizeError(null);
      setVideoPolishFailed(false);
      setVideoCacheKey(1);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setStarting(false);
    }
  }, [url, task]);

  const loadRecordedVideo = useCallback(async () => {
    if (!jobId) return;
    setVideoFinalizeError(null);
    setVideoPolishFailed(false);
    setVideoFinalizeBusy(true);
    try {
      const res = await fetch(API_ROUTES.uxJourneyAgentVideoFinalize(jobId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const raw = (await res.json().catch(() => ({}))) as { status?: string; detail?: unknown };
      if (!res.ok) {
        setVideoFinalizeError(
          typeof raw.detail === "string" ? raw.detail : t("chat.uxJourney.videoFinalizeError"),
        );
        return;
      }
      if (raw.status === "failed") {
        setVideoPolishFailed(true);
      }
      setVideoCacheKey(Date.now());
      setVideoRevealed(true);
    } catch (e) {
      setVideoFinalizeError(e instanceof Error ? e.message : t("chat.uxJourney.videoFinalizeError"));
    } finally {
      setVideoFinalizeBusy(false);
    }
  }, [jobId, t]);

  useEffect(() => {
    if (!jobId || status !== "running") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(API_ROUTES.uxJourneyAgentStatus(jobId), { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as AgentRunResponse & { detail?: string };
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          setError((data as any).detail || data.error || `Failed (${res.status})`);
          return;
        }
        const st = (data.status || "").toLowerCase();
        // The agent returns partial `result` even while running; only treat it as complete
        // when the upstream status says so (or when success is explicitly set).
        const hasFinalResult = data?.result?.success === true || data?.result?.success === false;
        if (st === "complete" || hasFinalResult) {
          setResult(data);
          setStatus("complete");
          return;
        }
        if (st === "error") {
          setStatus("error");
          setError(data.error || "Run failed");
          return;
        }
        setTimeout(poll, 2000);
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setError(e instanceof Error ? e.message : "Network error");
        }
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [jobId, status]);

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      <MsqdxTypography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        {t("nav.uxJourneyAgent")}
      </MsqdxTypography>
      <MsqdxTypography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        Start a browser-based UX journey run (URL + natural language task). Steps appear after completion; optionally load a screen recording — no live preview during the run.
      </MsqdxTypography>

      <MsqdxCard variant="flat" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
          <MsqdxFormField
            label="URL"
            value={url}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
            placeholder="https://example.com"
            fullWidth
          />
          <MsqdxFormField
            label="Task"
            value={task}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTask(e.target.value)}
            placeholder='e.g. "Find product X and add it to cart"'
            fullWidth
          />
        </Box>
        <Box sx={{ display: "flex", gap: 1, mt: 2, alignItems: "center", flexWrap: "wrap" }}>
          <MsqdxButton
            variant="contained"
            onClick={start}
            disabled={starting || !url.trim() || !task.trim()}
          >
            {starting ? "Starting…" : "Start run"}
          </MsqdxButton>
          {jobId && (
            <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
              Job: {jobId}
            </MsqdxTypography>
          )}
          {status !== "idle" && (
            <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
              Status: {status}
            </MsqdxTypography>
          )}
        </Box>
        {error && (
          <Box sx={{ mt: 2 }}>
            <MsqdxTypography variant="body2" sx={{ color: "error.main" }}>
              {error}
            </MsqdxTypography>
          </Box>
        )}
      </MsqdxCard>

      {jobId && status === "running" && (
        <MsqdxCard variant="flat" sx={{ p: 2, mb: 2 }}>
          <MsqdxTypography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic" }}>
            {t("chat.uxJourney.runningNoLive")}
          </MsqdxTypography>
        </MsqdxCard>
      )}

      {jobId && status === "complete" && (
        <>
          <MsqdxCard variant="flat" sx={{ p: 2, mb: 2 }}>
            <MsqdxTypography variant="subtitle2" sx={{ mb: 1 }}>
              {t("chat.uxJourney.videoOfferTitle")}
            </MsqdxTypography>
            {result?.result?.videoUrl ? (
              !videoRevealed ? (
                <>
                  <MsqdxTypography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
                    {t("chat.uxJourney.videoOfferHint")}
                  </MsqdxTypography>
                  {videoFinalizeError ? (
                    <MsqdxTypography variant="body2" sx={{ color: "error.main", mb: 1 }}>
                      {videoFinalizeError}
                    </MsqdxTypography>
                  ) : null}
                  <MsqdxButton
                    variant="outlined"
                    disabled={videoFinalizeBusy}
                    onClick={() => void loadRecordedVideo()}
                  >
                    {videoFinalizeBusy ? t("chat.uxJourney.videoFinalizeBusy") : t("chat.uxJourney.videoShow")}
                  </MsqdxButton>
                </>
              ) : (
                <>
                  {videoPolishFailed ? (
                    <MsqdxTypography variant="body2" sx={{ color: "warning.main", mb: 1 }}>
                      {t("chat.uxJourney.videoPolishFailed")}
                    </MsqdxTypography>
                  ) : null}
                  <Box
                    component="video"
                    controls
                    playsInline
                    preload="metadata"
                    src={`${API_ROUTES.uxJourneyAgentVideo(jobId)}?v=${videoCacheKey}`}
                  onLoadedMetadata={(e: React.SyntheticEvent<HTMLVideoElement>) => {
                    e.currentTarget.playbackRate = getUxJourneyVideoPlaybackRate();
                  }}
                  sx={{ width: "100%", maxWidth: 960, borderRadius: 1, display: "block", backgroundColor: "#000" }}
                  />
                </>
              )
            ) : (
              <MsqdxTypography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic" }}>
                {t("chat.uxJourney.videoUnavailable")}
              </MsqdxTypography>
            )}
          </MsqdxCard>

          <MsqdxCard variant="flat" sx={{ p: 2 }}>
            <MsqdxTypography variant="subtitle2" sx={{ mb: 1 }}>
              Steps ({steps.length})
            </MsqdxTypography>
            {steps.length === 0 ? (
              <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                No steps available.
              </MsqdxTypography>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {steps.map((s, idx) => {
                  const shotSrc = uxJourneyStepShotSrc(s);
                  return (
                  <Box
                    key={idx}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                      backgroundColor: "background.paper",
                    }}
                  >
                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.25 }}>
                      Step {s.step ?? idx + 1} · {s.action ?? "step"}
                    </MsqdxTypography>
                    {shotSrc ? (
                      <Box
                        component="img"
                        src={shotSrc}
                        alt={`Step ${s.step ?? idx + 1} screenshot`}
                        sx={{
                          width: "100%",
                          maxWidth: 960,
                          height: 180,
                          objectFit: "cover",
                          borderRadius: 1,
                          border: "1px solid",
                          borderColor: "divider",
                          mb: 1,
                          display: "block",
                        }}
                      />
                    ) : null}
                    {s.target ? (
                      <MsqdxTypography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {normalizeReasoningText(s.target)}
                      </MsqdxTypography>
                    ) : null}
                    {s.reasoning ? (
                      <Box sx={{ mb: 0.5 }}>
                        <MsqdxTypography
                          variant="caption"
                          sx={{
                            color: "text.secondary",
                            textTransform: "uppercase",
                            letterSpacing: 0.6,
                            display: "block",
                            mb: 0.25,
                          }}
                        >
                          Reasoning
                        </MsqdxTypography>
                        <ChatMessageMarkdown
                          dense
                          content={normalizeReasoningText(s.reasoning)}
                        />
                      </Box>
                    ) : null}
                    {s.result ? (
                      <Box>
                        <MsqdxTypography
                          variant="caption"
                          sx={{
                            color: "text.secondary",
                            textTransform: "uppercase",
                            letterSpacing: 0.6,
                            display: "block",
                            mb: 0.25,
                          }}
                        >
                          Result
                        </MsqdxTypography>
                        <ChatMessageMarkdown
                          dense
                          content={normalizeReasoningText(s.result)}
                        />
                      </Box>
                    ) : null}
                  </Box>
                  );
                })}
              </Box>
            )}
          </MsqdxCard>
        </>
      )}
    </Box>
  );
}

