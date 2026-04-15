"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { PersonaListItem, TargetGroupListItem } from "@msqdx-glass/types";
import { Box, Stack } from "@mui/material";
import { MsqdxAvatar, MsqdxMoleculeCard, MsqdxButton, MsqdxTypography, MsqdxIcon } from "@msqdx/react";
import { useAuth } from "../auth/auth-provider";
import { useI18n } from "../i18n/i18n-provider";
import { ADMIN_ROUTES } from "../../lib/routes";
import { safePersonaAvatarSrc } from "../../lib/persona-avatar";
import { useProject } from "../projects/project-provider";

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
  const { projects } = useProject();
  const accent = "var(--color-theme-accent)";
  const [hour, setHour] = useState(12);
  useEffect(() => {
    setHour(new Date().getHours());
  }, []);
  const greetingKey = getGreetingKey(hour);
  const displayName = user?.name?.trim() || user?.email?.trim() || "";
  const greetingTitle = `${t(`adminDashboard.${greetingKey}`)}${displayName ? `, ${displayName}` : ""}`;

  return (
    <Box className="msqdx-admin-dashboard" sx={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
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

      {projects.length === 0 ? (
        <MsqdxMoleculeCard
          variant="flat"
          borderRadius="button"
          title={t("adminDashboard.easySetupCardTitle")}
          titleVariant="h6"
          subtitle={t("adminDashboard.easySetupCardSubtitle")}
          headerActions={<MsqdxIcon name="auto_awesome" customSize={20} style={{ color: accent }} />}
          actions={(
            <Link href={ADMIN_ROUTES.setup} style={{ textDecoration: "none" }}>
              <MsqdxButton
                variant="contained"
                size="small"
                endIcon={<MsqdxIcon name="arrow_forward" customSize={16} />}
                sx={{
                  backgroundColor: accent,
                  color: "white",
                  "&:hover": { backgroundColor: accent, filter: "brightness(1.05)" },
                }}
              >
                {t("adminDashboard.easySetupCta")}
              </MsqdxButton>
            </Link>
          )}
          sx={{
            mb: 3,
            border: "1px solid",
            borderColor: accent,
            "&:hover": { borderColor: accent },
            "& .MuiTypography-h6": { color: accent },
          }}
        />
      ) : null}

      {/* Three main cards: Projects, Personas & Target Groups */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", lg: "1fr 1fr 1fr" },
          gap: 2,
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        <MsqdxMoleculeCard
          variant="flat"
          borderRadius="button"
          title={t("adminDashboard.projects")}
          titleVariant="h6"
          subtitle={t("adminDashboard.projectsCount", { count: projects.length })}
          headerActions={<MsqdxIcon name="folder" customSize={20} style={{ color: accent }} />}
          actions={(
            <Link href={ADMIN_ROUTES.projects} style={{ textDecoration: "none" }}>
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
          {projects.length === 0 ? (
            <MsqdxTypography variant="body2" color="text.secondary">
              {t("adminDashboard.noProjects")}
            </MsqdxTypography>
          ) : (
            <Stack spacing={1.25}>
              {projects.slice(0, 5).map((project) => (
                <Link
                  key={project.id}
                  href={ADMIN_ROUTES.projectDetail(project.id)}
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
                      <MsqdxIcon name="folder" customSize={20} style={{ color: accent }} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <MsqdxTypography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                        {project.name || "—"}
                      </MsqdxTypography>
                      <MsqdxTypography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                        {project.id}
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
          title={t("adminDashboard.personas")}
          titleVariant="h6"
          subtitle={t("adminDashboard.personasCount", { count: personaTotal })}
          headerActions={<MsqdxIcon name="person" customSize={20} style={{ color: accent }} />}
          actions={(
            <Link href={ADMIN_ROUTES.personas} style={{ textDecoration: "none" }}>
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
                  href={ADMIN_ROUTES.personas}
                  style={{ textDecoration: "none", color: "inherit" }}
                  className="msqdx-admin-dashboard-persona-row"
                >
                  <Box
                    className="msqdx-admin-dashboard-teaser-row"
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
                    <MsqdxAvatar
                      size="md"
                      src={safePersonaAvatarSrc(persona.avatarUrl ?? persona.imageUrl, persona.id)}
                      alt={persona.name}
                      fallback={(persona.name ?? "").trim() || "?"}
                      bordered
                      sx={{
                        borderColor: accent,
                        backgroundColor: accent,
                        color: "white",
                        flexShrink: 0,
                      }}
                    />
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
            <Link href={ADMIN_ROUTES.targetGroups} style={{ textDecoration: "none" }}>
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
                  href={ADMIN_ROUTES.targetGroups}
                  style={{ textDecoration: "none", color: "inherit" }}
                  className="msqdx-admin-dashboard-tg-row"
                >
                  <Box
                    className="msqdx-admin-dashboard-teaser-row"
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
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap">
          <Link href={ADMIN_ROUTES.setup} style={{ textDecoration: "none" }}>
            <MsqdxButton
              variant="outlined"
              size="medium"
              startIcon={<MsqdxIcon name="auto_awesome" customSize={18} />}
              sx={{
                borderColor: accent,
                color: accent,
                "&:hover": { borderColor: accent, backgroundColor: "transparent" },
              }}
            >
              {t("adminDashboard.easySetupCta")}
            </MsqdxButton>
          </Link>
          <Link href={ADMIN_ROUTES.personas} style={{ textDecoration: "none" }}>
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
          <Link href={ADMIN_ROUTES.targetGroups} style={{ textDecoration: "none" }}>
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
