"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { PersonaListItem, TargetGroupListItem } from "@msqdx-glass/types";
import { Box, Button, Stack, Typography } from "@mui/material";
import { MsqdxIcon } from "@msqdx/react";
import { useAuth } from "../auth/auth-provider";
import { useI18n } from "../i18n/i18n-provider";

export type MsqdxGlassAdminDashboardProps = {
  personaItems: PersonaListItem[];
  personaTotal: number;
  targetGroupItems: TargetGroupListItem[];
  targetGroupTotal: number;
};

function getGreetingKey(hour: number): "greetingMorning" | "greetingAfternoon" | "greetingEvening" {
  if (hour >= 5 && hour < 12) return "greetingMorning";
  if (hour >= 12 && hour < 18) return "greetingAfternoon";
  return "greetingEvening";
}

export const MsqdxGlassAdminDashboard = ({
  personaItems,
  personaTotal,
  targetGroupItems,
  targetGroupTotal,
}: MsqdxGlassAdminDashboardProps) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [hour, setHour] = useState(12);
  useEffect(() => {
    setHour(new Date().getHours());
  }, []);
  const greetingKey = getGreetingKey(hour);
  const displayName = user?.name?.trim() || user?.email?.trim() || "";

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      {/* Time-based greeting + username */}
      <Box
        className="msqdx-glass-panel"
        sx={{
          p: 2,
          mb: 3,
          border: "1px solid var(--color-theme-accent)",
          borderRadius: 0,
          minWidth: 0,
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 600, color: "var(--color-theme-accent)" }}>
          {t(`adminDashboard.${greetingKey}`)}
          {displayName ? `, ${displayName}` : ""}
        </Typography>
        <Typography variant="body1" sx={{ mt: 0.5, color: "text.secondary" }}>
          {t("adminDashboard.greetingSubtitle")}
        </Typography>
      </Box>

      {/* Two main cards: Personas & Target Groups */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Personas card */}
        <Box
          className="msqdx-glass-panel"
          sx={{
            p: 0,
            border: "1px solid var(--color-theme-accent)",
            borderRadius: 0,
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 1,
              p: 2,
              borderBottom: "1px solid var(--color-theme-accent)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <MsqdxIcon name="person" customSize={24} style={{ color: "var(--color-theme-accent)" }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {t("adminDashboard.personas")}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {t("adminDashboard.personasCount", { count: personaTotal })}
            </Typography>
          </Box>
          <Box sx={{ p: 2, pt: 1.5, flex: 1 }}>
            {personaTotal === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {t("adminDashboard.noPersonas")}
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {personaItems.slice(0, 5).map((persona) => (
                  <Link
                    key={persona.id}
                    href="/admin/personas"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        p: 1.25,
                        borderRadius: 1,
                        border: "1px solid transparent",
                        "&:hover": {
                          borderColor: "var(--color-theme-accent)",
                          backgroundColor: "rgba(182, 56, 255, 0.06)",
                        },
                        transition: "border-color 0.2s, background-color 0.2s",
                      }}
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          bgcolor: "var(--color-theme-accent)",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 600,
                          fontSize: "0.9rem",
                          flexShrink: 0,
                        }}
                      >
                        {(persona.name || "?").charAt(0).toUpperCase()}
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                          {persona.name || "—"}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap display="block">
                          {persona.headline || persona.segment || "—"}
                        </Typography>
                      </Box>
                      <MsqdxIcon name="chevron_right" customSize={18} style={{ color: "var(--color-theme-accent)", flexShrink: 0 }} />
                    </Box>
                  </Link>
                ))}
              </Stack>
            )}
          </Box>
          <Box sx={{ p: 2, pt: 0, borderTop: "1px solid var(--color-theme-accent)" }}>
            <Link href="/admin/personas" style={{ textDecoration: "none" }}>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                endIcon={<MsqdxIcon name="arrow_forward" customSize={16} />}
                sx={{
                  borderColor: "var(--color-theme-accent)",
                  color: "var(--color-theme-accent)",
                  "&:hover": {
                    borderColor: "var(--color-theme-accent)",
                    backgroundColor: "rgba(182, 56, 255, 0.1)",
                  },
                }}
              >
                {t("adminDashboard.viewAll")}
              </Button>
            </Link>
          </Box>
        </Box>

        {/* Target groups card */}
        <Box
          className="msqdx-glass-panel"
          sx={{
            p: 0,
            border: "1px solid var(--color-theme-accent)",
            borderRadius: 0,
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 1,
              p: 2,
              borderBottom: "1px solid var(--color-theme-accent)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <MsqdxIcon name="groups" customSize={24} style={{ color: "var(--color-theme-accent)" }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {t("adminDashboard.targetGroups")}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {t("adminDashboard.targetGroupsCount", { count: targetGroupTotal })}
            </Typography>
          </Box>
          <Box sx={{ p: 2, pt: 1.5, flex: 1 }}>
            {targetGroupTotal === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {t("adminDashboard.noTargetGroups")}
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {targetGroupItems.slice(0, 5).map((tg) => (
                  <Link
                    key={tg.id}
                    href="/admin/target-groups"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        p: 1.25,
                        borderRadius: 1,
                        border: "1px solid transparent",
                        "&:hover": {
                          borderColor: "var(--color-theme-accent)",
                          backgroundColor: "rgba(182, 56, 255, 0.06)",
                        },
                        transition: "border-color 0.2s, background-color 0.2s",
                      }}
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 1,
                          bgcolor: "rgba(182, 56, 255, 0.15)",
                          color: "var(--color-theme-accent)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <MsqdxIcon name="groups" customSize={20} />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                          {tg.name || "—"}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap display="block">
                          {tg.segment || "—"} · {t("adminDashboard.personasCount", { count: tg.personaCount ?? 0 })}
                        </Typography>
                      </Box>
                      <MsqdxIcon name="chevron_right" customSize={18} style={{ color: "var(--color-theme-accent)", flexShrink: 0 }} />
                    </Box>
                  </Link>
                ))}
              </Stack>
            )}
          </Box>
          <Box sx={{ p: 2, pt: 0, borderTop: "1px solid var(--color-theme-accent)" }}>
            <Link href="/admin/target-groups" style={{ textDecoration: "none" }}>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                endIcon={<MsqdxIcon name="arrow_forward" customSize={16} />}
                sx={{
                  borderColor: "var(--color-theme-accent)",
                  color: "var(--color-theme-accent)",
                  "&:hover": {
                    borderColor: "var(--color-theme-accent)",
                    backgroundColor: "rgba(182, 56, 255, 0.1)",
                  },
                }}
              >
                {t("adminDashboard.viewAll")}
              </Button>
            </Link>
          </Box>
        </Box>
      </Box>

      {/* Quick actions */}
      <Box
        className="msqdx-glass-panel"
        sx={{
          p: 2,
          mt: 3,
          border: "1px solid var(--color-theme-accent)",
          borderRadius: 0,
          minWidth: 0,
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          {t("adminDashboard.quickActions")}
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Link href="/admin/personas" style={{ textDecoration: "none" }}>
            <Button
              variant="contained"
              size="medium"
              startIcon={<MsqdxIcon name="person" customSize={18} />}
              sx={{
                backgroundColor: "var(--color-theme-accent)",
                color: "white",
                "&:hover": {
                  backgroundColor: "rgba(182, 56, 255, 0.9)",
                },
              }}
            >
              {t("adminDashboard.createPersona")}
            </Button>
          </Link>
          <Link href="/admin/target-groups" style={{ textDecoration: "none" }}>
            <Button
              variant="contained"
              size="medium"
              startIcon={<MsqdxIcon name="groups" customSize={18} />}
              sx={{
                backgroundColor: "var(--color-theme-accent)",
                color: "white",
                "&:hover": {
                  backgroundColor: "rgba(182, 56, 255, 0.9)",
                },
              }}
            >
              {t("adminDashboard.createTargetGroup")}
            </Button>
          </Link>
        </Stack>
      </Box>
    </Box>
  );
};
