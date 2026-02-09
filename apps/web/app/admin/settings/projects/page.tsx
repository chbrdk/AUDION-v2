"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { Box, Stack } from "@mui/material";
import { MsqdxButton, MsqdxCard, MsqdxFormField, MsqdxSelect, MsqdxTypography } from "@msqdx/react";

import { useProject, type ProjectMember, type ProjectSummary } from "../../../../components/projects/project-provider";

const roleOptions = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
];

export default function SettingsProjectsPage() {
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
        setActionError(err instanceof Error ? err.message : "Failed to load members");
      } finally {
        setMembersLoading(false);
      }
    };

    if (activeProjectId) {
      void loadMembers(activeProjectId);
    } else {
      setMembers([]);
    }
  }, [activeProjectId, getProjectDetail]);

  const projectDisplayName = useMemo(() => {
    if (activeProject?.name) return activeProject.name;
    const fallback = safeProjects.find((project) => project.id === activeProjectId);
    return fallback?.name ?? "No project selected";
  }, [activeProject, activeProjectId, safeProjects]);

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      setActionError("Project name is required.");
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
      setActionError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const handleAddMember = async () => {
    if (!activeProjectId) {
      setActionError("Select a project first.");
      return;
    }
    if (!memberEmail.trim()) {
      setActionError("Email is required.");
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
      setActionError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setUpdatingMembers(false);
    }
  };

  const handleRemoveMember = async (member: ProjectMember) => {
    if (!activeProjectId) return;
    if (!confirm(`Remove ${member.email} from this project?`)) {
      return;
    }
    setUpdatingMembers(true);
    setActionError(null);
    try {
      await removeMember(activeProjectId, member.id);
      setMembers((prev) => prev.filter((item) => item.id !== member.id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setUpdatingMembers(false);
    }
  };

  return (
    <div className="msqdx-glass-panel">
      <header className="msqdx-glass-detail__header">
        <div>
          <p className="msqdx-glass-eyebrow">Workspace</p>
          <h1 style={{ margin: 0 }}>Projects</h1>
          <p className="msqdx-glass-muted" style={{ maxWidth: "640px" }}>
            Every persona, target group, journey, and prompt template is scoped to a project. Switch
            between projects or invite teammates to collaborate.
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
            Active Project
          </MsqdxTypography>
          <MsqdxTypography variant="body1" weight="semibold">
            {projectDisplayName}
          </MsqdxTypography>
          <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
            {activeProjectId ? activeProjectId : "Pick a project to start working."}
          </MsqdxTypography>
        </MsqdxCard>

        <MsqdxCard variant="flat" borderRadius="button" sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 1.5 }}>
            Your Projects
          </MsqdxTypography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 2 }}>
            {safeProjects.length === 0 && (
              <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                No projects yet. Create one below.
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
                    {project.id === activeProjectId ? "Selected" : "Select"}
                  </MsqdxButton>
                </Box>
              </MsqdxCard>
            ))}
          </Box>
        </MsqdxCard>

        <MsqdxCard variant="flat" borderRadius="button" sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 1.5 }}>
            Create Project
          </MsqdxTypography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-end">
            <MsqdxFormField
              label="Project Name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Audion Q1 Research"
              fullWidth
            />
            <MsqdxButton variant="contained" onClick={handleCreateProject} disabled={creating}>
              {creating ? "Creating..." : "Create"}
            </MsqdxButton>
          </Stack>
        </MsqdxCard>

        <MsqdxCard variant="flat" borderRadius="button" sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 1.5 }}>
            Members
          </MsqdxTypography>
          {!activeProjectId && (
            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
              Select a project to manage members.
            </MsqdxTypography>
          )}
          {activeProjectId && (
            <>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-end" sx={{ mb: 2 }}>
                <MsqdxFormField
                  label="User Email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  fullWidth
                />
                <MsqdxSelect
                  label="Role"
                  value={memberRole}
                  onChange={(event: any) => setMemberRole(event.target.value)}
                  options={roleOptions}
                  size="small"
                />
                <MsqdxButton variant="outlined" onClick={handleAddMember} disabled={updatingMembers}>
                  Add Member
                </MsqdxButton>
              </Stack>

              {membersLoading && (
                <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                  Loading members...
                </MsqdxTypography>
              )}
              {!membersLoading && members.length === 0 && (
                <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                  No additional members yet.
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
                            Remove
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
