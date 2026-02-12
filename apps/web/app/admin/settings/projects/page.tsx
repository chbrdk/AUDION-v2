"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { Box, Stack } from "@mui/material";
import { MsqdxButton, MsqdxCard, MsqdxFormField, MsqdxSelect, MsqdxTypography } from "@msqdx/react";

import { useProject, type ProjectMember, type ProjectSummary } from "../../../../components/projects/project-provider";
import { useI18n } from "../../../../components/i18n/i18n-provider";

export default function SettingsProjectsPage() {
  const { t } = useI18n();
  const roleOptions = [
    { value: "member", label: t("settingsProjects.roles.member") },
    { value: "admin", label: t("settingsProjects.roles.admin") },
  ];
  const {
    projects,
    activeProjectId,
    activeProject,
    selectProject,
    createProject,
    getProjectDetail,
    addMember,
    removeMember,
    refreshProjects,
  } = useProject();

  const safeProjects = Array.isArray(projects) ? projects : [];

  const [projectName, setProjectName] = useState("");
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("member");
  const [actionError, setActionError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [updatingMembers, setUpdatingMembers] = useState(false);

  useEffect(() => {
    const loadMembers = async (projectId: string) => {
      setMembersLoading(true);
      setActionError(null);
      try {
        const detail = await getProjectDetail(projectId);
        setMembers(Array.isArray(detail.members) ? detail.members : []);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : t("settingsProjects.errors.loadMembers"));
      } finally {
        setMembersLoading(false);
      }
    };

    if (activeProjectId) {
      void loadMembers(activeProjectId);
    } else {
      setMembers([]);
    }
  }, [activeProjectId, getProjectDetail, t]);

  const projectDisplayName = useMemo(() => {
    if (activeProject?.name) return activeProject.name;
    const fallback = safeProjects.find((project) => project.id === activeProjectId);
    return fallback?.name ?? t("settingsProjects.noProjectSelected");
  }, [activeProject, activeProjectId, safeProjects, t]);

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      setActionError(t("settingsProjects.errors.projectNameRequired"));
      return;
    }
    setCreating(true);
    setActionError(null);
    try {
      const created = await createProject(projectName.trim());
      await refreshProjects();
      selectProject(created.id);
      setProjectName("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("settingsProjects.errors.createProject"));
    } finally {
      setCreating(false);
    }
  };

  const handleAddMember = async () => {
    if (!activeProjectId) {
      setActionError(t("settingsProjects.errors.selectProjectFirst"));
      return;
    }
    if (!memberEmail.trim()) {
      setActionError(t("settingsProjects.errors.emailRequired"));
      return;
    }
    setUpdatingMembers(true);
    setActionError(null);
    try {
      const newMember = await addMember(activeProjectId, {
        email: memberEmail.trim(),
        role: memberRole,
      });
      setMembers((prev) => {
        const existingIndex = prev.findIndex((member) => member.id === newMember.id);
        if (existingIndex === -1) {
          return [...prev, newMember];
        }
        const next = [...prev];
        next[existingIndex] = newMember;
        return next;
      });
      setMemberEmail("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("settingsProjects.errors.addMember"));
    } finally {
      setUpdatingMembers(false);
    }
  };

  const handleRemoveMember = async (member: ProjectMember) => {
    if (!activeProjectId) return;
    if (!confirm(t("settingsProjects.confirmRemove", { email: member.email }))) {
      return;
    }
    setUpdatingMembers(true);
    setActionError(null);
    try {
      await removeMember(activeProjectId, member.id);
      setMembers((prev) => prev.filter((item) => item.id !== member.id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("settingsProjects.errors.removeMember"));
    } finally {
      setUpdatingMembers(false);
    }
  };

  return (
    <div className="msqdx-glass-panel">
      <header className="msqdx-glass-detail__header">
        <div>
          <p className="msqdx-glass-eyebrow">{t("settingsProjects.eyebrow")}</p>
          <h1 style={{ margin: 0 }}>{t("settingsProjects.title")}</h1>
          <p className="msqdx-glass-muted" style={{ maxWidth: "640px" }}>
            {t("settingsProjects.subtitle")}
          </p>
        </div>
      </header>

      {actionError && (
        <div className="msqdx-glass-error" style={{ marginBottom: "1rem" }}>
          {actionError}
        </div>
      )}

      <Stack spacing={3}>
        <MsqdxCard variant="flat" borderRadius="button" sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 1.5 }}>
            {t("settingsProjects.activeProject.title")}
          </MsqdxTypography>
          <MsqdxTypography variant="body1" weight="semibold">
            {projectDisplayName}
          </MsqdxTypography>
          <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
            {activeProjectId ? activeProjectId : t("settingsProjects.activeProject.empty")}
          </MsqdxTypography>
        </MsqdxCard>

        <MsqdxCard variant="flat" borderRadius="button" sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 0.5 }}>
            {t("settingsProjects.aiTemplates.title")}
          </MsqdxTypography>
          <MsqdxTypography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            {t("settingsProjects.aiTemplates.description")}
          </MsqdxTypography>
          <Box>
            <MsqdxButton
              variant="outlined"
              size="small"
              onClick={() => window.location.href = "/admin/settings/prompts"}
            >
              {t("settingsProjects.aiTemplates.manageTemplates")}
            </MsqdxButton>
          </Box>
        </MsqdxCard>

        <MsqdxCard variant="flat" borderRadius="button" sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 1.5 }}>
            {t("settingsProjects.yourProjects.title")}
          </MsqdxTypography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 2 }}>
            {safeProjects.length === 0 && (
              <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                {t("settingsProjects.yourProjects.empty")}
              </MsqdxTypography>
            )}
            {safeProjects.map((project: ProjectSummary) => (
              <MsqdxCard
                key={project.id}
                variant="flat"
                borderRadius="button"
                sx={{
                  p: 2,
                  border: "1px solid",
                  borderColor: project.id === activeProjectId ? "primary.main" : "divider",
                }}
              >
                <MsqdxTypography variant="subtitle1" weight="semibold">
                  {project.name}
                </MsqdxTypography>
                <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                  {project.id}
                </MsqdxTypography>
                <Box sx={{ mt: 1 }}>
                  <MsqdxButton
                    variant={project.id === activeProjectId ? "contained" : "outlined"}
                    size="small"
                    onClick={() => selectProject(project.id)}
                  >
                    {project.id === activeProjectId ? t("settingsProjects.yourProjects.selected") : t("settingsProjects.yourProjects.select")}
                  </MsqdxButton>
                </Box>
              </MsqdxCard>
            ))}
          </Box>
        </MsqdxCard>

        <MsqdxCard variant="flat" borderRadius="button" sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 1.5 }}>
            {t("settingsProjects.createProject.title")}
          </MsqdxTypography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-end">
            <MsqdxFormField
              label={t("settingsProjects.createProject.name")}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder={t("settingsProjects.createProject.placeholder")}
              fullWidth
            />
            <MsqdxButton variant="contained" onClick={handleCreateProject} disabled={creating}>
              {creating ? t("settingsProjects.createProject.creating") : t("settingsProjects.createProject.cta")}
            </MsqdxButton>
          </Stack>
        </MsqdxCard>

        <MsqdxCard variant="flat" borderRadius="button" sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 1.5 }}>
            {t("settingsProjects.members.title")}
          </MsqdxTypography>
          {!activeProjectId && (
            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
              {t("settingsProjects.members.empty")}
            </MsqdxTypography>
          )}
          {activeProjectId && (
            <>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-end" sx={{ mb: 2 }}>
                <MsqdxFormField
                  label={t("settingsProjects.members.userEmail")}
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder={t("settingsProjects.members.userEmailPlaceholder")}
                  fullWidth
                />
                <MsqdxSelect
                  label={t("settingsProjects.members.role")}
                  value={memberRole}
                  onChange={(event: any) => setMemberRole(event.target.value)}
                  options={roleOptions}
                  size="small"
                />
                <MsqdxButton variant="outlined" onClick={handleAddMember} disabled={updatingMembers}>
                  {t("settingsProjects.members.addMember")}
                </MsqdxButton>
              </Stack>

              {membersLoading && (
                <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                  {t("settingsProjects.members.loading")}
                </MsqdxTypography>
              )}
              {!membersLoading && members.length === 0 && (
                <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                  {t("settingsProjects.members.none")}
                </MsqdxTypography>
              )}
              {!membersLoading && members.length > 0 && (
                <Stack spacing={1}>
                  {members.map((member) => (
                    <MsqdxCard
                      key={member.id}
                      variant="flat"
                      borderRadius="button"
                      sx={{ p: 1.5, border: "1px solid", borderColor: "divider" }}
                    >
                      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems="center">
                        <Box sx={{ flex: 1 }}>
                          <MsqdxTypography variant="subtitle2" weight="semibold">
                            {member.name || member.email}
                          </MsqdxTypography>
                          <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                            {member.email} · {member.role}
                          </MsqdxTypography>
                        </Box>
                        {member.role !== "owner" && (
                          <MsqdxButton
                            variant="text"
                            size="small"
                            onClick={() => handleRemoveMember(member)}
                            disabled={updatingMembers}
                          >
                            {t("settingsProjects.members.remove")}
                          </MsqdxButton>
                        )}
                      </Stack>
                    </MsqdxCard>
                  ))}
                </Stack>
              )}
            </>
          )}
        </MsqdxCard>
      </Stack>
    </div>
  );
}
