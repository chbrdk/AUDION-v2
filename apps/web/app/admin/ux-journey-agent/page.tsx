"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";
import { MsqdxButton, MsqdxCard, MsqdxFormField, MsqdxTypography } from "@msqdx/react";

import { API_ROUTES } from "../../../lib/api-routes";
import { useI18n } from "../../../components/i18n/i18n-provider";

type Status = "idle" | "running" | "complete" | "error";

type AgentStep = {
  step?: number;
  action?: string;
  target?: string | null;
  result?: string | null;
  reasoning?: string | null;
  screenshot?: string | null;
  timestamp?: string;
};

type AgentRunResponse = {
  status?: string;
  jobId?: string;
  result?: {
    steps?: AgentStep[];
    success?: boolean;
    taskDescription?: string;
    siteDomain?: string;
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
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setStarting(false);
    }
  }, [url, task]);

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
        Start a browser-based UX journey run (URL + natural language task). View live stream while running, and video/steps after completion.
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
          <MsqdxTypography variant="subtitle2" sx={{ mb: 1 }}>
            Live view
          </MsqdxTypography>
          <Box
            component="img"
            src={API_ROUTES.uxJourneyAgentLiveStream(jobId)}
            alt="Live stream"
            sx={{
              width: "100%",
              maxWidth: 960,
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
              display: "block",
            }}
          />
        </MsqdxCard>
      )}

      {jobId && status === "complete" && (
        <>
          <MsqdxCard variant="flat" sx={{ p: 2, mb: 2 }}>
            <MsqdxTypography variant="subtitle2" sx={{ mb: 1 }}>
              Video
            </MsqdxTypography>
            <Box
              component="video"
              controls
              playsInline
              src={API_ROUTES.uxJourneyAgentVideo(jobId)}
              sx={{ width: "100%", maxWidth: 960, borderRadius: 1, display: "block", backgroundColor: "#000" }}
            />
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
                {steps.map((s, idx) => (
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
                    {s.screenshot ? (
                      <Box
                        component="img"
                        src={s.screenshot}
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
                    {(s.target || s.result || s.reasoning) ? (
                      <MsqdxTypography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {[
                          s.target ? `Target: ${s.target}` : null,
                          s.reasoning ? `Reasoning: ${s.reasoning}` : null,
                          s.result ? `Result: ${s.result}` : null,
                        ].filter(Boolean).join("\n")}
                      </MsqdxTypography>
                    ) : null}
                  </Box>
                ))}
              </Box>
            )}
          </MsqdxCard>
        </>
      )}
    </Box>
  );
}

