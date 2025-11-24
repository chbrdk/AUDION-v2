"use client";

import Link from "next/link";
import type { QueueStatsResponse } from "@udg-glass/types";
import { Box, Button, Stack, Typography } from "@mui/material";
import { MaterialSymbol } from "../material-symbol";

export type UdgGlassAdminDashboardProps = {
  personaStats: { total: number };
  targetGroupStats: { total: number };
  queueStats: QueueStatsResponse;
};

export const UdgGlassAdminDashboard = ({
  personaStats,
  targetGroupStats,
  queueStats
}: UdgGlassAdminDashboardProps) => {
  const totalQueueJobs = queueStats.pendingCount + queueStats.processingCount + 
                         queueStats.completedCount + queueStats.failedCount;

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      {/* KPI Cards Grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
          gap: "0.5rem",
          marginBottom: "0.75rem",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box"
        }}
      >
        {/* Personas KPI Card */}
        <Box
          className="udg-glass-panel"
          sx={{
            padding: "0",
            border: "1px solid var(--color-secondary-dx-purple)",
            borderRadius: 0,
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box"
          }}
        >
          <Stack spacing={0.125}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <MaterialSymbol icon="person" fontSize={24} style={{ color: "var(--color-secondary-dx-purple)" }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Personas
              </Typography>
            </Box>
            <Typography variant="h3" sx={{ fontSize: "2.5rem", fontWeight: 300 }}>
              {personaStats.total}
            </Typography>
            <Link href="/admin/personas" style={{ textDecoration: "none" }}>
              <Button
                variant="outlined"
                size="small"
                sx={{
                  borderColor: "var(--color-secondary-dx-purple)",
                  color: "var(--color-secondary-dx-purple)",
                  "&:hover": {
                    borderColor: "var(--color-secondary-dx-purple)",
                    backgroundColor: "rgba(182, 56, 255, 0.1)"
                  }
                }}
              >
                Anzeigen
              </Button>
            </Link>
          </Stack>
        </Box>

        {/* Target Groups KPI Card */}
        <Box
          className="udg-glass-panel"
          sx={{
            padding: "0",
            border: "1px solid var(--color-secondary-dx-purple)",
            borderRadius: 0,
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box"
          }}
        >
          <Stack spacing={0.125}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <MaterialSymbol icon="groups" fontSize={24} style={{ color: "var(--color-secondary-dx-purple)" }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Target Groups
              </Typography>
            </Box>
            <Typography variant="h3" sx={{ fontSize: "2.5rem", fontWeight: 300 }}>
              {targetGroupStats.total}
            </Typography>
            <Link href="/admin/target-groups" style={{ textDecoration: "none" }}>
              <Button
                variant="outlined"
                size="small"
                sx={{
                  borderColor: "var(--color-secondary-dx-purple)",
                  color: "var(--color-secondary-dx-purple)",
                  "&:hover": {
                    borderColor: "var(--color-secondary-dx-purple)",
                    backgroundColor: "rgba(182, 56, 255, 0.1)"
                  }
                }}
              >
                Anzeigen
              </Button>
            </Link>
          </Stack>
        </Box>

        {/* Queue Jobs KPI Card */}
        <Box
          className="udg-glass-panel"
          sx={{
            padding: "0",
            border: "1px solid var(--color-secondary-dx-purple)",
            borderRadius: 0,
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box"
          }}
        >
          <Stack spacing={0.125}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <MaterialSymbol icon="view_list" fontSize={24} style={{ color: "var(--color-secondary-dx-purple)" }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Queue Jobs
              </Typography>
            </Box>
            <Typography variant="h3" sx={{ fontSize: "2.5rem", fontWeight: 300 }}>
              {totalQueueJobs}
            </Typography>
            <Link href="/admin/queue" style={{ textDecoration: "none" }}>
              <Button
                variant="outlined"
                size="small"
                sx={{
                  borderColor: "var(--color-secondary-dx-purple)",
                  color: "var(--color-secondary-dx-purple)",
                  "&:hover": {
                    borderColor: "var(--color-secondary-dx-purple)",
                    backgroundColor: "rgba(182, 56, 255, 0.1)"
                  }
                }}
              >
                Anzeigen
              </Button>
            </Link>
          </Stack>
        </Box>

        {/* Queue Status KPI Card */}
        <Box
          className="udg-glass-panel"
          sx={{
            padding: "0",
            border: "1px solid var(--color-secondary-dx-purple)",
            borderRadius: 0,
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box"
          }}
        >
          <Stack spacing={0.125}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <MaterialSymbol 
                icon={queueStats.workerAvailable ? "check_circle" : "error"} 
                fontSize={24} 
                style={{ color: "var(--color-secondary-dx-purple)" }} 
              />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Workers
              </Typography>
            </Box>
            <Typography variant="h3" sx={{ fontSize: "2.5rem", fontWeight: 300 }}>
              {queueStats.workerCount}
            </Typography>
            <Typography variant="body2" sx={{ color: "var(--color-text-secondary)" }}>
              {queueStats.workerAvailable ? "Available" : "Not available"}
            </Typography>
          </Stack>
        </Box>
      </Box>

      {/* Quick Actions */}
      <Box
        className="udg-glass-panel"
        sx={{
          padding: "0",
          border: "1px solid var(--color-secondary-dx-purple)",
          borderRadius: 0,
          marginBottom: "2rem",
          minWidth: 0,
          maxWidth: "100%",
          boxSizing: "border-box"
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600, marginBottom: "1rem" }}>
          Quick Actions
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Link href="/admin/personas" style={{ textDecoration: "none" }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<MaterialSymbol icon="person" fontSize={14} />}
              sx={{
                backgroundColor: "var(--color-secondary-dx-purple)",
                color: "white",
                "&:hover": {
                  backgroundColor: "rgba(182, 56, 255, 0.9)"
                }
              }}
            >
              Create New Persona
            </Button>
          </Link>
          <Link href="/admin/target-groups" style={{ textDecoration: "none" }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<MaterialSymbol icon="groups" fontSize={14} />}
              sx={{
                backgroundColor: "var(--color-secondary-dx-purple)",
                color: "white",
                "&:hover": {
                  backgroundColor: "rgba(182, 56, 255, 0.9)"
                }
              }}
            >
              Create New Target Group
            </Button>
          </Link>
        </Stack>
      </Box>

      {/* Queue Status Details */}
      {(queueStats.pendingCount > 0 || queueStats.processingCount > 0 || 
        queueStats.failedCount > 0) && (
        <Box
          className="udg-glass-panel"
          sx={{
            padding: "0",
            border: "1px solid var(--color-secondary-dx-purple)",
            borderRadius: 0,
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box"
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, marginBottom: "1rem" }}>
            Queue Status
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            {queueStats.pendingCount > 0 && (
              <Box>
                <Typography variant="body2" sx={{ color: "var(--color-text-secondary)" }}>
                  Pending
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {queueStats.pendingCount}
                </Typography>
              </Box>
            )}
            {queueStats.processingCount > 0 && (
              <Box>
                <Typography variant="body2" sx={{ color: "var(--color-text-secondary)" }}>
                  Processing
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {queueStats.processingCount}
                </Typography>
              </Box>
            )}
            {queueStats.failedCount > 0 && (
              <Box>
                <Typography variant="body2" sx={{ color: "var(--color-secondary-dx-pink)" }}>
                  Failed
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 600, color: "var(--color-secondary-dx-pink)" }}>
                  {queueStats.failedCount}
                </Typography>
              </Box>
            )}
            {queueStats.completedCount > 0 && (
              <Box>
                <Typography variant="body2" sx={{ color: "var(--color-text-secondary)" }}>
                  Completed
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {queueStats.completedCount}
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>
      )}
    </Box>
  );
};


