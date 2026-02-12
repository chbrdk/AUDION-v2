"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { PersonaListItem, TargetGroupListItem } from "@msqdx-glass/types";
import { Box, Stack } from "@mui/material";
import { MsqdxMoleculeCard, MsqdxButton, MsqdxTypography, MsqdxIcon } from "@msqdx/react";
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
  const greetingTitle = `${t(`adminDashboard.${greetingKey}`)}${displayName ? `, ${displayName}` : ""}`;

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      {/* Time-based greeting + username */}
      <MsqdxMoleculeCard
        variant="flat"
        borderRadius="button"
        title={greetingTitle}
        titleVariant="h4"
        subtitle={t("adminDashboard.greetingSubtitle")}
        sx={{
          mb: 3,
          minWidth: 0,
          maxWidth: "100%",
          border: "1px solid",
          borderColor: accent,
          "&:hover": { borderColor: accent },
          "& .MuiTypography-h4": { color: accent, fontWeight: 600 },
        }}
      />

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
        <MsqdxMoleculeCard
          variant="flat"
          borderRadius="button"
          title={t("adminDashboard.personas")}
          titleVariant="h6"
          subtitle={t("adminDashboard.personasCount", { count: personaTotal })}
          headerActions={<MsqdxIcon name="person" customSize={20} style={{ color: accent }} />}
          actions={(
            <Link href="/admin/personas" style={{ textDecoration: "none" }}>
              <MsqdxButton
                variant="outlined"
                size="small"
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
          )}
          sx={{
            minWidth: 0,
            maxWidth: "100%",
            border: "1px solid",
            borderColor: accent,
            "&:hover": { borderColor: accent },
            "& .MuiTypography-h6": { color: accent },
          }}
        >
          {personaTotal === 0 ? (
            <MsqdxTypography variant="body2" color="text.secondary">
              {t("adminDashboard.noPersonas")}
            </MsqdxTypography>
          ) : (
            <Stack spacing={1.25}>
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
                      gap: 1.25,
                      p: 1.25,
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                      "&:hover": { borderColor: accent },
                      transition: "border-color 0.2s",
                    }}
                  >
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        bgcolor: accent,
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
                    <MsqdxIcon name="chevron_right" customSize={18} style={{ color: accent, flexShrink: 0 }} />
                  </Box>
                </Link>
              ))}
            </Stack>
          )}
        </MsqdxMoleculeCard>

        <MsqdxMoleculeCard
          variant="flat"
          borderRadius="button"
          title={t("adminDashboard.targetGroups")}
          titleVariant="h6"
          subtitle={t("adminDashboard.targetGroupsCount", { count: targetGroupTotal })}
          headerActions={<MsqdxIcon name="groups" customSize={20} style={{ color: accent }} />}
          actions={(
            <Link href="/admin/target-groups" style={{ textDecoration: "none" }}>
              <MsqdxButton
                variant="outlined"
                size="small"
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
          )}
          sx={{
            minWidth: 0,
            maxWidth: "100%",
            border: "1px solid",
            borderColor: accent,
            "&:hover": { borderColor: accent },
            "& .MuiTypography-h6": { color: accent },
          }}
        >
          {targetGroupTotal === 0 ? (
            <MsqdxTypography variant="body2" color="text.secondary">
              {t("adminDashboard.noTargetGroups")}
            </MsqdxTypography>
          ) : (
            <Stack spacing={1.25}>
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
                      gap: 1.25,
                      p: 1.25,
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                      "&:hover": { borderColor: accent },
                      transition: "border-color 0.2s",
                    }}
                  >
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        bgcolor: "rgba(0, 0, 0, 0.04)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <MsqdxIcon name="groups" customSize={20} style={{ color: accent }} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <MsqdxTypography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                        {tg.name || "—"}
                      </MsqdxTypography>
                      <MsqdxTypography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                        {tg.segment || "—"} · {t("adminDashboard.personasCount", { count: tg.personaCount ?? 0 })}
                      </MsqdxTypography>
                    </Box>
                    <MsqdxIcon name="chevron_right" customSize={18} style={{ color: accent, flexShrink: 0 }} />
                  </Box>
                </Link>
              ))}
            </Stack>
          )}
        </MsqdxMoleculeCard>
      </Box>

      {/* Quick actions */}
      <MsqdxMoleculeCard
        variant="flat"
        borderRadius="button"
        title={t("adminDashboard.quickActions")}
        titleVariant="h6"
        sx={{ mt: 3, minWidth: 0, maxWidth: "100%", borderColor: accent, "&:hover": { borderColor: accent } }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Link href="/admin/personas" style={{ textDecoration: "none" }}>
            <MsqdxButton
              variant="contained"
              size="medium"
              startIcon={<MsqdxIcon name="person" customSize={18} />}
              sx={{
                backgroundColor: accent,
                color: "white",
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
                color: "white",
                "&:hover": { backgroundColor: accent, filter: "brightness(1.05)" },
              }}
            >
              {t("adminDashboard.createTargetGroup")}
            </MsqdxButton>
          </Link>
        </Stack>
      </MsqdxMoleculeCard>
    </Box>
  );
};
