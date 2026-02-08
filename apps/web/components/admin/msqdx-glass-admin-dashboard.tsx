"use client";

import { useState } from "react";
import Link from "next/link";
import type { QueueStatsResponse, ServiceStatusResponse } from "@msqdx-glass/types";
import { alpha, Box, Button, Collapse, Stack, Typography, useTheme } from "@mui/material";
import { MsqdxIcon } from "@msqdx/react";

export type MsqdxGlassAdminDashboardProps = {
  personaStats: { total: number };
  targetGroupStats: { total: number };
  queueStats: QueueStatsResponse;
  serviceStatus: ServiceStatusResponse | null;
};

export const MsqdxGlassAdminDashboard = ({
  personaStats,
  targetGroupStats,
  queueStats,
  serviceStatus
}: MsqdxGlassAdminDashboardProps) => {
  const theme = useTheme();
  const [showServices, setShowServices] = useState(false);
  const totalQueueJobs = (queueStats.pendingCount ?? 0) + (queueStats.processingCount ?? 0) + 
                         (queueStats.completedCount ?? 0) + (queueStats.failedCount ?? 0);
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "up":
        return "check_circle";
      case "down":
        return "error";
      default:
        return "help";
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case "up":
        return theme.palette.success.main;
      case "down":
        return theme.palette.error.main;
      default:
        return theme.palette.text.secondary;
    }
  };

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
          className="msqdx-glass-panel"
          sx={{
            padding: "0",
            border: "1px solid var(--color-theme-accent)",
            borderRadius: 0,
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box"
          }}
        >
          <Stack spacing={0.125}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <MsqdxIcon name="person" customSize={24} style={{ color: "var(--color-theme-accent)" }} />
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
                  borderColor: "var(--color-theme-accent)",
                  color: "var(--color-theme-accent)",
                  "&:hover": {
                    borderColor: "var(--color-theme-accent)",
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
          className="msqdx-glass-panel"
          sx={{
            padding: "0",
            border: "1px solid var(--color-theme-accent)",
            borderRadius: 0,
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box"
          }}
        >
          <Stack spacing={0.125}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <MsqdxIcon name="groups" customSize={24} style={{ color: "var(--color-theme-accent)" }} />
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
                  borderColor: "var(--color-theme-accent)",
                  color: "var(--color-theme-accent)",
                  "&:hover": {
                    borderColor: "var(--color-theme-accent)",
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
          className="msqdx-glass-panel"
          sx={{
            padding: "0",
            border: "1px solid var(--color-theme-accent)",
            borderRadius: 0,
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box"
          }}
        >
          <Stack spacing={0.125}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <MsqdxIcon name="view_list" customSize={24} style={{ color: "var(--color-theme-accent)" }} />
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
                  borderColor: "var(--color-theme-accent)",
                  color: "var(--color-theme-accent)",
                  "&:hover": {
                    borderColor: "var(--color-theme-accent)",
                    backgroundColor: "rgba(182, 56, 255, 0.1)"
                  }
                }}
              >
                Anzeigen
              </Button>
            </Link>
          </Stack>
        </Box>

        {/* Service Status KPI Card */}
        <Box
          className="msqdx-glass-panel"
          sx={{
            padding: "0",
            border: "1px solid var(--color-theme-accent)",
            borderRadius: 0,
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box"
          }}
        >
          <Stack spacing={0.125}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <MsqdxIcon
                name={serviceStatus?.allServicesUp ? "check_circle" : (serviceStatus ? "error" : "help")}
                customSize={24}
                style={{ color: "var(--color-theme-accent)" }}
              />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Services
              </Typography>
            </Box>
            {serviceStatus && serviceStatus.services ? (
              <>
                <Typography variant="h3" sx={{ fontSize: "2.5rem", fontWeight: 300 }}>
                  {serviceStatus.services.filter(s => s.status === "up").length}/{serviceStatus.services.length}
                </Typography>
                <Typography variant="body2" sx={{ color: "var(--color-text-secondary)" }}>
                  {serviceStatus.allServicesUp ? "All services up" : `${serviceStatus.services.filter(s => s.status === "down").length} service(s) down`}
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="h3" sx={{ fontSize: "2.5rem", fontWeight: 300 }}>
                  {queueStats.workerCount ?? 0}
                </Typography>
                <Typography variant="body2" sx={{ color: "var(--color-text-secondary)" }}>
                  {queueStats.workerAvailable ? "Workers available" : "Workers not available"}
                </Typography>
              </>
            )}
          </Stack>
        </Box>
      </Box>

      {/* Service Status Details */}
      {serviceStatus && serviceStatus.services && (
        <Box
          className="msqdx-glass-panel"
          sx={{
            padding: "0",
            border: "1px solid var(--color-theme-accent)",
            borderRadius: 0,
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box",
            marginBottom: "2rem"
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              p: 2,
              "&:hover": {
                backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.05 : 0.02)
              }
            }}
            onClick={() => setShowServices(!showServices)}
          >
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Service Status Details
            </Typography>
            <MsqdxIcon
              name={showServices ? "expand_less" : "expand_more"}
              customSize={24}
              style={{ color: "var(--color-theme-accent)" }}
            />
          </Box>
          <Collapse in={showServices}>
            <Box sx={{ p: 2, pt: 0 }}>
              <Stack spacing={1}>
                {serviceStatus.services.map((service) => (
                  <Box
                    key={service.name}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      p: 1.5,
                      borderRadius: 1,
                      backgroundColor: alpha(
                        getStatusColor(service.status),
                        theme.palette.mode === "dark" ? 0.1 : 0.05
                      ),
                      border: `1px solid ${alpha(getStatusColor(service.status), 0.3)}`
                    }}
                  >
                    <MsqdxIcon
                      name={getStatusIcon(service.status)}
                      customSize={20} 
                      style={{ color: getStatusColor(service.status) }} 
                    />
                    <Typography variant="body1" sx={{ flex: 1, fontWeight: 500 }}>
                      {service.name}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: getStatusColor(service.status),
                        textTransform: "uppercase",
                        fontWeight: 600,
                        fontSize: "0.75rem"
                      }}
                    >
                      {service.status}
                    </Typography>
                    {service.message && (
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: theme.palette.text.secondary,
                          fontStyle: "italic",
                          maxWidth: "300px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                        title={service.message}
                      >
                        {service.message}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            </Box>
          </Collapse>
        </Box>
      )}

      {/* Quick Actions */}
      <Box
        className="msqdx-glass-panel"
        sx={{
          padding: "0",
          border: "1px solid var(--color-theme-accent)",
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
              startIcon={<MsqdxIcon name="person" customSize={14} />}
              sx={{
                backgroundColor: "var(--color-theme-accent)",
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
              startIcon={<MsqdxIcon name="groups" customSize={14} />}
              sx={{
                backgroundColor: "var(--color-theme-accent)",
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
          className="msqdx-glass-panel"
          sx={{
            padding: "0",
            border: "1px solid var(--color-theme-accent)",
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


