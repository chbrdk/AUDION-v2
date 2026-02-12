"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { PersonaListItem, TargetGroupListItem } from "@msqdx-glass/types";
import { Box, Stack } from "@mui/material";
import { MsqdxCard, MsqdxButton, MsqdxTypography, MsqdxIcon } from "@msqdx/react";
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
  const accent = "var(--color-theme-accent)";
  const [hour, setHour] = useState(12);
  useEffect(() => {
    setHour(new Date().getHours());
  }, []);
  const greetingKey = getGreetingKey(hour);
  const displayName = user?.name?.trim() || user?.email?.trim() || "";

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      {/* Time-based greeting + username */}
      <MsqdxCard
        variant="flat"
        borderRadius="button"
        sx={{
          mb: 3,
          minWidth: 0,
          maxWidth: "100%",
          borderColor: accent,
          "&:hover": { borderColor: accent },
        }}
      >
        <MsqdxTypography variant="h4" sx={{ fontWeight: 600, color: "var(--color-theme-accent)" }}>
          {t(`adminDashboard.${greetingKey}`)}
          {displayName ? `, ${displayName}` : ""}
        </MsqdxTypography>
        <MsqdxTypography variant="body1" sx={{ mt: 0.5 }} color="text.secondary">
          {t("adminDashboard.greetingSubtitle")}
        </MsqdxTypography>
      </MsqdxCard>

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
        <MsqdxCard
          variant="flat"
          borderRadius="button"
          sx={{
            minWidth: 0,
            maxWidth: "100%",
            display: "flex",
            flexDirection: "column",
            p: 0,
            borderColor: accent,
            "&:hover": { borderColor: accent },
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 1,
                p: 2,
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <MsqdxIcon name="person" customSize={24} style={{ color: "var(--color-theme-accent)" }} />
                <MsqdxTypography variant="h6" sx={{ fontWeight: 600 }}>
                  {t("adminDashboard.personas")}
                </MsqdxTypography>
              </Box>
              <MsqdxTypography variant="body2" color="text.secondary">
                {t("adminDashboard.personasCount", { count: personaTotal })}
              </MsqdxTypography>
            </Box>
            <Box sx={{ p: 2, pt: 1.5, flex: 1 }}>
              {personaTotal === 0 ? (
                <MsqdxTypography variant="body2" color="text.secondary">
                  {t("adminDashboard.noPersonas")}
                </MsqdxTypography>
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
                          <MsqdxTypography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                            {persona.name || "—"}
                          </MsqdxTypography>
                          <MsqdxTypography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                            {persona.headline || persona.segment || "—"}
                          </MsqdxTypography>
                        </Box>
                        <MsqdxIcon name="chevron_right" customSize={18} style={{ color: "var(--color-theme-accent)", flexShrink: 0 }} />
                      </Box>
                    </Link>
                  ))}
                </Stack>
              )}
            </Box>
            <Box sx={{ p: 2, pt: 0, borderTop: "1px solid", borderColor: "divider" }}>
              <Link href="/admin/personas" style={{ textDecoration: "none", display: "block" }}>
                <MsqdxButton
                  variant="outlined"
                  size="small"
                  fullWidth
                  endIcon={<MsqdxIcon name="arrow_forward" customSize={16} />}
                  sx={{
                    borderColor: accent,
                    color: accent,
                    "&:hover": { borderColor: accent, backgroundColor: "transparent" },
                  }}
                >
                  {t("adminDashboard.viewAll")}
                </MsqdxButton>
              </Link>
            </Box>
          </Box>
        </MsqdxCard>

        {/* Target groups card */}
        <MsqdxCard
          variant="flat"
          borderRadius="button"
          sx={{
            minWidth: 0,
            maxWidth: "100%",
            display: "flex",
            flexDirection: "column",
            p: 0,
            borderColor: accent,
            "&:hover": { borderColor: accent },
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 1,
                p: 2,
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <MsqdxIcon name="groups" customSize={24} style={{ color: "var(--color-theme-accent)" }} />
                <MsqdxTypography variant="h6" sx={{ fontWeight: 600 }}>
                  {t("adminDashboard.targetGroups")}
                </MsqdxTypography>
              </Box>
              <MsqdxTypography variant="body2" color="text.secondary">
                {t("adminDashboard.targetGroupsCount", { count: targetGroupTotal })}
              </MsqdxTypography>
            </Box>
            <Box sx={{ p: 2, pt: 1.5, flex: 1 }}>
              {targetGroupTotal === 0 ? (
                <MsqdxTypography variant="body2" color="text.secondary">
                  {t("adminDashboard.noTargetGroups")}
                </MsqdxTypography>
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
                          <MsqdxTypography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                            {tg.name || "—"}
                          </MsqdxTypography>
                          <MsqdxTypography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                            {tg.segment || "—"} · {t("adminDashboard.personasCount", { count: tg.personaCount ?? 0 })}
                          </MsqdxTypography>
                        </Box>
                        <MsqdxIcon name="chevron_right" customSize={18} style={{ color: "var(--color-theme-accent)", flexShrink: 0 }} />
                      </Box>
                    </Link>
                  ))}
                </Stack>
              )}
            </Box>
            <Box sx={{ p: 2, pt: 0, borderTop: "1px solid", borderColor: "divider" }}>
              <Link href="/admin/target-groups" style={{ textDecoration: "none", display: "block" }}>
                <MsqdxButton
                  variant="outlined"
                  size="small"
                  fullWidth
                  endIcon={<MsqdxIcon name="arrow_forward" customSize={16} />}
                  sx={{
                    borderColor: accent,
                    color: accent,
                    "&:hover": { borderColor: accent, backgroundColor: "transparent" },
                  }}
                >
                  {t("adminDashboard.viewAll")}
                </MsqdxButton>
              </Link>
            </Box>
          </Box>
        </MsqdxCard>
      </Box>

      {/* Quick actions */}
      <MsqdxCard
        variant="flat"
        borderRadius="button"
        sx={{ mt: 3, minWidth: 0, maxWidth: "100%", borderColor: accent, "&:hover": { borderColor: accent } }}
      >
        <MsqdxTypography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          {t("adminDashboard.quickActions")}
        </MsqdxTypography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Link href="/admin/personas" style={{ textDecoration: "none" }}>
            <MsqdxButton
              variant="contained"
              size="medium"
              startIcon={<MsqdxIcon name="person" customSize={18} />}
              sx={{
                backgroundColor: accent,
                "&:hover": { backgroundColor: accent, filter: "brightness(1.05)" },
              }}
            >
              {t("adminDashboard.createPersona")}
            </MsqdxButton>
          </Link>
          <Link href="/admin/target-groups" style={{ textDecoration: "none" }}>
            <MsqdxButton
              variant="contained"
              size="medium"
              startIcon={<MsqdxIcon name="groups" customSize={18} />}
              sx={{
                backgroundColor: accent,
                "&:hover": { backgroundColor: accent, filter: "brightness(1.05)" },
              }}
            >
              {t("adminDashboard.createTargetGroup")}
            </MsqdxButton>
          </Link>
        </Stack>
      </MsqdxCard>
    </Box>
  );
};
