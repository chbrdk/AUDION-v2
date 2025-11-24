"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import clsx from "clsx";

import type {
  ProcessingJobDetailResponse,
  ProcessingJobListItem,
  ProcessingJobListResponse,
  QueueStatsResponse,
} from "@udg-glass/types";

import {
  fetchProcessingJob,
  fetchProcessingJobs,
  fetchQueueStats,
  retryJob,
} from "../app/api/_lib/queue";
import { MaterialSymbol } from "./material-symbol";

type UdgGlassQueueDashboardProps = {
  initialStats: QueueStatsResponse;
};

const statusChips: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "udg-glass-chip --pending" },
  processing: { label: "Processing", className: "udg-glass-chip --processing" },
  completed: { label: "Completed", className: "udg-glass-chip --success" },
  failed: { label: "Failed", className: "udg-glass-chip --error" },
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const notify = (message: string) => {
  if (typeof window === "undefined") {
    return;
  }

  const existingToasts = document.querySelectorAll(".udg-glass-toast");
  existingToasts.forEach((toast) => (toast as any).remove());

  const toast = document.createElement("div");
  toast.className = "udg-glass-toast";
  toast.textContent = message;

  Object.assign(toast.style, {
    position: "fixed",
    bottom: "30px",
    right: "30px",
    background: "#0f172a",
    color: "#ffffff",
    padding: "16px 24px",
    borderRadius: "8px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
    zIndex: "99999",
    fontSize: "15px",
    fontWeight: "500",
    maxWidth: "450px",
    minWidth: "200px",
    animation: "slideIn 0.3s ease-out",
    pointerEvents: "auto",
    fontFamily: "system-ui, -apple-system, sans-serif",
    border: "2px solid rgba(255, 255, 255, 0.1)",
  });

  document.body.appendChild(toast);
  void toast.offsetHeight;

  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease-out";
    setTimeout(() => {
      toast.parentNode?.removeChild(toast);
    }, 300);
  }, 5000);
};

export const UdgGlassQueueDashboard = ({ initialStats }: UdgGlassQueueDashboardProps) => {
  const [stats, setStats] = useState<QueueStatsResponse>(initialStats);
  const [jobs, setJobs] = useState<ProcessingJobListResponse>({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
  });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState<ProcessingJobDetailResponse | null>(
    null
  );
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const statsData = await fetchQueueStats();
      setStats(statsData);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const jobsData = await fetchProcessingJobs({
        status: filterStatus || undefined,
        page,
        pageSize: 20,
      });
      setJobs(jobsData);
    } catch (error) {
      console.error("Failed to load jobs:", error);
      notify("Error loading jobs");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, page]);

  const loadJobDetail = useCallback(async (jobId: string) => {
    try {
      const detail = await fetchProcessingJob(jobId);
      setSelectedJobDetail(detail);
    } catch (error) {
      console.error("Failed to load job detail:", error);
      notify("Error loading job details");
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    void loadStats();
    const interval = setInterval(() => {
      void loadStats();
      void loadJobs();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [loadStats, loadJobs]);

  useEffect(() => {
    if (selectedJobId) {
      void loadJobDetail(selectedJobId);
    }
  }, [selectedJobId, loadJobDetail]);

  const handleRetry = async (jobId: string) => {
    if (!confirm("Are you sure you want to retry this job?")) {
      return;
    }
    try {
      await retryJob(jobId);
      notify("Job retried");
      await loadJobs();
      await loadStats();
    } catch (error) {
      console.error("Retry failed:", error);
      notify("Error retrying job");
    }
  };

  return (
    <div className="udg-glass-admin-grid">
      <section className="udg-glass-panel">
        <header className="udg-glass-panel__header">
          <div>
            <h2>Queue Statistics</h2>
          </div>
          <button className="udg-glass-button --ghost" onClick={loadStats}>
            <MaterialSymbol icon="refresh" fontSize={18} /> Refresh
          </button>
        </header>
        <div className="udg-glass-stats-grid">
          <div className="udg-glass-stat-card">
            <div className="udg-glass-stat-card__label">Pending</div>
            <div className="udg-glass-stat-card__value">{stats.pendingCount}</div>
          </div>
          <div className="udg-glass-stat-card">
            <div className="udg-glass-stat-card__label">Processing</div>
            <div className="udg-glass-stat-card__value">{stats.processingCount}</div>
          </div>
          <div className="udg-glass-stat-card">
            <div className="udg-glass-stat-card__label">Completed</div>
            <div className="udg-glass-stat-card__value">{stats.completedCount}</div>
          </div>
          <div className="udg-glass-stat-card">
            <div className="udg-glass-stat-card__label">Failed</div>
            <div className="udg-glass-stat-card__value">{stats.failedCount}</div>
          </div>
          <div className="udg-glass-stat-card">
            <div className="udg-glass-stat-card__label">Workers</div>
            <div className="udg-glass-stat-card__value">
              {stats.workerCount} {stats.workerAvailable ? "✓" : "✗"}
            </div>
          </div>
        </div>

        <div style={{ marginTop: "2rem" }}>
          <h3>Jobs</h3>
          <div className="udg-glass-field" style={{ marginBottom: "1rem" }}>
            <label>Status Filter</label>
            <select
              value={filterStatus || ""}
              onChange={(e) => {
                setFilterStatus(e.target.value || null);
                setPage(1);
              }}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {loading && <p className="udg-glass-muted">Loading jobs...</p>}
          {!loading && jobs.items.length === 0 && (
            <p className="udg-glass-empty">No jobs found.</p>
          )}
          {!loading && jobs.items.length > 0 && (
            <div className="udg-glass-list">
              {jobs.items.map((job) => {
                const chip = statusChips[job.status] ?? statusChips.pending;
                return (
                  <button
                    key={job.id}
                    className={clsx(
                      "udg-glass-list-item",
                      selectedJobId === job.id && "is-active"
                    )}
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    <div className="udg-glass-list-item__row">
                      <strong>Job {job.id.slice(0, 8)}</strong>
                      <span className={chip.className}>{chip.label}</span>
                    </div>
                    <p className="udg-glass-list-item__meta">
                      Document: {job.documentId.slice(0, 8)}...
                    </p>
                    <p className="udg-glass-list-item__meta">
                      Progress: {job.progress.toFixed(0)}% · {formatDate(job.createdAt)}
                    </p>
                    {job.error && (
                      <p className="udg-glass-list-item__meta udg-glass-error">
                        Error: {job.error}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {jobs.total > jobs.page_size && (
            <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button
                className="udg-glass-button --ghost"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                <MaterialSymbol icon="chevron_left" fontSize={18} />
              </button>
              <span className="udg-glass-muted">
                Page {page} of {Math.ceil(jobs.total / jobs.page_size)}
              </span>
              <button
                className="udg-glass-button --ghost"
                disabled={page >= Math.ceil(jobs.total / jobs.page_size)}
                onClick={() => setPage(page + 1)}
              >
                <MaterialSymbol icon="chevron_right" fontSize={18} />
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="udg-glass-panel">
        {!selectedJobId && <p className="udg-glass-empty">Please select a job.</p>}
        {selectedJobId && !selectedJobDetail && (
          <p className="udg-glass-muted">Loading job details...</p>
        )}
        {selectedJobDetail && (
          <div className="udg-glass-detail">
            <header className="udg-glass-detail__header">
              <div className="udg-glass-detail__title">
                <h2>Job {selectedJobDetail.id.slice(0, 8)}</h2>
                {selectedJobDetail.status === "failed" && (
                  <button
                    className="udg-glass-button"
                    onClick={() => handleRetry(selectedJobDetail.id)}
                  >
                    <MaterialSymbol icon="refresh" fontSize={18} /> Retry
                  </button>
                )}
              </div>
            </header>

            <div className="udg-glass-detail__grid">
              <div>
                <h3>Details</h3>
                <dl className="udg-glass-meta-grid">
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <span
                        className={
                          statusChips[selectedJobDetail.status]?.className || "udg-glass-chip"
                        }
                      >
                        {statusChips[selectedJobDetail.status]?.label || selectedJobDetail.status}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Progress</dt>
                    <dd>{selectedJobDetail.progress.toFixed(0)}%</dd>
                  </div>
                  <div>
                    <dt>Document ID</dt>
                    <dd>{selectedJobDetail.documentId}</dd>
                  </div>
                  {selectedJobDetail.documentFilename && (
                    <div>
                      <dt>Filename</dt>
                      <dd>{selectedJobDetail.documentFilename}</dd>
                    </div>
                  )}
                  {selectedJobDetail.documentSizeBytes && (
                    <div>
                      <dt>Size</dt>
                      <dd>{(selectedJobDetail.documentSizeBytes / 1024).toFixed(1)} KB</dd>
                    </div>
                  )}
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDate(selectedJobDetail.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{formatDate(selectedJobDetail.updatedAt)}</dd>
                  </div>
                  {selectedJobDetail.celeryTaskId && (
                    <div>
                      <dt>Celery Task ID</dt>
                      <dd>{selectedJobDetail.celeryTaskId}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {selectedJobDetail.error && (
              <div className="udg-glass-detail__section">
                <h3>Error</h3>
                <pre
                  style={{
                    padding: "1rem",
                    background: "var(--color-secondary-dx-pink-tint)",
                    borderRadius: "8px",
                    color: "var(--color-secondary-dx-pink-on-light)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {selectedJobDetail.error}
                </pre>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

