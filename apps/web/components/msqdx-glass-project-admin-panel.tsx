"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Box, Stack, TextField } from "@mui/material";
import Link from "next/link";
import { MsqdxButton, MsqdxCard, MsqdxFormField, MsqdxTypography, MsqdxIcon, MsqdxDashboardCard, MsqdxChip } from "@msqdx/react";
import { MsqdxGlassCollapsiblePanel } from "./admin/msqdx-glass-collapsible-panel";
import { buildApiUrl } from "../app/api/_lib/backend";
import { aiAssistApi, type AiTemplateSummary } from "../app/api/_lib/ai-assist";
import { useProject, type ProjectSummary, type ProjectMember } from "./projects/project-provider";
import { useI18n } from "./i18n/i18n-provider";

type ProjectDetail = {
    id: string;
    name: string;
    description?: string | null;
    company_context?: string | null;
    created_at: string;
    updated_at: string;
    members: ProjectMember[];
    stats: {
        persona_count: number;
        target_group_count: number;
        template_override_count: number;
    };
    recent_personas?: Array<{ id: string; name: string; segment: string }>;
    recent_target_groups?: Array<{ id: string; name: string; segment: string }>;
    template_overrides?: Array<{ key: string; label: string }>;
};

type MsqdxGlassProjectAdminPanelProps = {
    initialProjects: ProjectSummary[];
    activeProjectId: string | null;
    mode?: "full" | "detail";
};

const formatDate = (value?: string | null) => {
    if (!value) return "—";
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
    if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
            new Notification(message);
        }
    }
    console.log(message);
};

export function MsqdxGlassProjectAdminPanel({
    initialProjects,
    activeProjectId,
    mode = "full",
}: MsqdxGlassProjectAdminPanelProps) {
    const { t } = useI18n();
    const accent = "var(--color-theme-accent)";
    const {
        projects: providerProjects,
        activeProject,
        selectProject,
        createProject: createProjectViaProvider,
        getProjectDetail,
        addMember,
        removeMember,
        refreshProjects,
    } = useProject();

    // State
    const [projects, setProjects] = useState<ProjectSummary[]>(initialProjects);
    const [selectedId, setSelectedId] = useState<string | null>(activeProjectId);
    const [detail, setDetail] = useState<ProjectDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [listRefreshing, setListRefreshing] = useState(false);

    // Debug logging
    useEffect(() => {
        console.log('[ProjectAdminPanel] Initial props:', {
            initialProjects,
            initialProjectsCount: initialProjects.length,
            activeProjectId
        });
        console.log('[ProjectAdminPanel] Projects state:', projects, 'count:', projects.length);
    }, [initialProjects, projects, activeProjectId]);

    // Create Project State
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newProjectName, setNewProjectName] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Member Management State
    const [memberEmail, setMemberEmail] = useState("");
    const [memberRole, setMemberRole] = useState("member");
    const [updatingMembers, setUpdatingMembers] = useState(false);
    const [memberError, setMemberError] = useState<string | null>(null);

    // Accordion state for collapsible sections
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(["overview", "company-context", "suggest-target-groups", "members", "prompt-templates"])
    );

    // Company context form state (synced from detail on load)
    const [companyDescription, setCompanyDescription] = useState("");
    const [companyContext, setCompanyContext] = useState("");
    const [savingContext, setSavingContext] = useState(false);
    const [contextSaveError, setContextSaveError] = useState<string | null>(null);

    // Suggest target groups state
    type TargetGroupSuggestion = { name: string; segment: string; description: string };
    const [suggestions, setSuggestions] = useState<TargetGroupSuggestion[]>([]);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const [suggestError, setSuggestError] = useState<string | null>(null);
    const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
    const [creatingTgIds, setCreatingTgIds] = useState<Set<number>>(new Set());

    // Prompt templates for this project (full list for cards)
    const [promptTemplates, setPromptTemplates] = useState<AiTemplateSummary[]>([]);
    const [promptTemplatesLoading, setPromptTemplatesLoading] = useState(false);

    const toggleSection = useCallback((section: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(section)) {
                next.delete(section);
            } else {
                next.add(section);
            }
            return next;
        });
    }, []);

    // Load project detail
    const loadDetail = useCallback(
        async (projectId: string) => {
            try {
                setDetailLoading(true);
                setDetailError(null);

                // Fetch project detail from provider
                const basicDetail = await getProjectDetail(projectId);

                // Fetch additional stats (personas, target groups, templates)
                const [personasRes, targetGroupsRes, templatesRes] = await Promise.allSettled([
                    fetch(buildApiUrl(`/api/personas?project_id=${encodeURIComponent(projectId)}&page_size=5`), {
                        cache: "no-store",
                    }),
                    fetch(buildApiUrl(`/api/target-groups?project_id=${encodeURIComponent(projectId)}&page_size=5`), {
                        cache: "no-store",
                    }),
                    fetch(buildApiUrl(`/api/ai-assist/templates?project_id=${encodeURIComponent(projectId)}`), {
                        cache: "no-store",
                    }),
                ]);

                let personaCount = 0;
                let recentPersonas: Array<{ id: string; name: string; segment: string }> = [];
                if (personasRes.status === "fulfilled" && personasRes.value.ok) {
                    const data = await personasRes.value.json();
                    personaCount = data.total || 0;
                    recentPersonas = (data.items || []).slice(0, 5).map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        segment: p.segment || "",
                    }));
                }

                let targetGroupCount = 0;
                let recentTargetGroups: Array<{ id: string; name: string; segment: string }> = [];
                if (targetGroupsRes.status === "fulfilled" && targetGroupsRes.value.ok) {
                    const data = await targetGroupsRes.value.json();
                    targetGroupCount = data.total || 0;
                    recentTargetGroups = (data.items || []).slice(0, 5).map((tg: any) => ({
                        id: tg.id,
                        name: tg.name,
                        segment: tg.segment || "",
                    }));
                }

                let templateOverrideCount = 0;
                let templateOverrides: Array<{ key: string; label: string }> = [];
                if (templatesRes.status === "fulfilled" && templatesRes.value.ok) {
                    const data = await templatesRes.value.json();
                    const templates = data.templates || [];
                    // Count only overridden templates
                    const overridden = templates.filter((t: any) => t.is_overridden);
                    templateOverrideCount = overridden.length;
                    templateOverrides = overridden.slice(0, 5).map((t: any) => ({
                        key: t.key,
                        label: t.label || t.key,
                    }));
                }

                setDetail({
                    id: basicDetail.id,
                    name: basicDetail.name,
                    description: basicDetail.description ?? null,
                    company_context: basicDetail.company_context ?? null,
                    created_at: basicDetail.created_at || "",
                    updated_at: basicDetail.updated_at || "",
                    members: basicDetail.members || [],
                    stats: {
                        persona_count: personaCount,
                        target_group_count: targetGroupCount,
                        template_override_count: templateOverrideCount,
                    },
                    recent_personas: recentPersonas,
                    recent_target_groups: recentTargetGroups,
                    template_overrides: templateOverrides,
                });
            } catch (error) {
                console.error("Failed to load project detail:", error);
                setDetailError(error instanceof Error ? error.message : "Failed to load project");
            } finally {
                setDetailLoading(false);
            }
        },
        [getProjectDetail]
    );

    // Refresh project list
    const refreshList = useCallback(async () => {
        setListRefreshing(true);
        try {
            await refreshProjects();
            const response = await fetch(buildApiUrl(`/api/projects`), { cache: "no-store" });
            if (response.ok) {
                const data = await response.json();
                setProjects(data.items || []);
                notify(t("settingsProjects.messages.listRefreshed") || "Projects updated");
            }
        } catch (error) {
            console.error("Failed to refresh projects:", error);
        } finally {
            setListRefreshing(false);
        }
    }, [refreshProjects, t]);

    // Create new project
    const handleCreateProject = useCallback(async () => {
        if (!newProjectName.trim()) {
            setCreateError(t("settingsProjects.errors.projectNameRequired"));
            return;
        }

        setCreating(true);
        setCreateError(null);
        try {
            const created = await createProjectViaProvider(newProjectName.trim());
            await refreshList();
            setSelectedId(created.id);
            selectProject(created.id);
            setNewProjectName("");
            setShowCreateForm(false);
            notify(t("settingsProjects.messages.projectCreated") || "Project created");
        } catch (error) {
            console.error("Failed to create project:", error);
            setCreateError(error instanceof Error ? error.message : t("settingsProjects.errors.createProject"));
        } finally {
            setCreating(false);
        }
    }, [newProjectName, createProjectViaProvider, refreshList, selectProject, t]);

    // Add member
    const handleAddMember = useCallback(async () => {
        if (!selectedId) {
            setMemberError(t("settingsProjects.errors.selectProjectFirst"));
            return;
        }
        if (!memberEmail.trim()) {
            setMemberError(t("settingsProjects.errors.emailRequired"));
            return;
        }

        setUpdatingMembers(true);
        setMemberError(null);
        try {
            await addMember(selectedId, { email: memberEmail.trim(), role: memberRole });
            setMemberEmail("");
            await loadDetail(selectedId);
            notify(t("settingsProjects.messages.memberAdded") || "Member added");
        } catch (error) {
            console.error("Failed to add member:", error);
            setMemberError(error instanceof Error ? error.message : t("settingsProjects.errors.addMember"));
        } finally {
            setUpdatingMembers(false);
        }
    }, [selectedId, memberEmail, memberRole, addMember, loadDetail, t]);

    // Remove member
    const handleRemoveMember = useCallback(
        async (member: ProjectMember) => {
            if (!selectedId) return;
            if (!confirm(t("settingsProjects.confirmRemove", { email: member.email }))) return;

            setUpdatingMembers(true);
            setMemberError(null);
            try {
                await removeMember(selectedId, member.id);
                await loadDetail(selectedId);
                notify(t("settingsProjects.messages.memberRemoved") || "Member removed");
            } catch (error) {
                console.error("Failed to remove member:", error);
                setMemberError(error instanceof Error ? error.message : t("settingsProjects.errors.removeMember"));
            } finally {
                setUpdatingMembers(false);
            }
        },
        [selectedId, removeMember, loadDetail, t]
    );

    // Load detail when selection changes
    useEffect(() => {
        if (selectedId) {
            loadDetail(selectedId);
        } else {
            setDetail(null);
        }
    }, [selectedId, loadDetail]);

    // Sync company context form from detail
    useEffect(() => {
        if (detail) {
            setCompanyDescription(detail.description ?? "");
            setCompanyContext(detail.company_context ?? "");
        }
    }, [detail?.id, detail?.description, detail?.company_context]);

    // Save company context (PATCH project)
    const handleSaveCompanyContext = useCallback(async () => {
        if (!selectedId) return;
        setSavingContext(true);
        setContextSaveError(null);
        try {
            const res = await fetch(buildApiUrl(`/api/projects/${selectedId}`), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description: companyDescription || null, company_context: companyContext || null }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail ?? res.statusText ?? "Save failed");
            }
            await loadDetail(selectedId);
            notify(t("settingsProjects.companyContext.saved") ?? "Company context saved");
        } catch (e) {
            setContextSaveError(e instanceof Error ? e.message : "Save failed");
        } finally {
            setSavingContext(false);
        }
    }, [selectedId, companyDescription, companyContext, loadDetail, t]);

    const handleSuggestTargetGroups = useCallback(async () => {
        if (!selectedId) return;
        setSuggestLoading(true);
        setSuggestError(null);
        setSuggestions([]);
        setSelectedSuggestions(new Set());
        try {
            const res = await fetch(buildApiUrl(`/api/projects/${selectedId}/suggest-target-groups`), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ max_suggestions: 5 }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail ?? res.statusText ?? "Suggest failed");
            }
            const data = await res.json();
            setSuggestions(data.suggestions ?? []);
        } catch (e) {
            setSuggestError(e instanceof Error ? e.message : "Suggest failed");
        } finally {
            setSuggestLoading(false);
        }
    }, [selectedId]);

    const toggleSuggestion = useCallback((index: number) => {
        setSelectedSuggestions((prev) => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    }, []);

    const handleCreateTargetGroups = useCallback(async (indices?: Set<number>) => {
        const toCreateSet = indices ?? selectedSuggestions;
        if (!selectedId || toCreateSet.size === 0) return;
        const toCreate = Array.from(toCreateSet).map((i) => ({ index: i, ...suggestions[i] }));
        for (const { index, name, segment, description } of toCreate) {
            setCreatingTgIds((prev) => new Set(prev).add(index));
            try {
                const res = await fetch(buildApiUrl("/api/target-groups"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ project_id: selectedId, name, segment, description: description || null }),
                });
                if (!res.ok) throw new Error("Create failed");
                setSelectedSuggestions((prev) => { const n = new Set(prev); n.delete(index); return n; });
                setSuggestions((prev) => prev.filter((_, i) => i !== index));
                notify(t("settingsProjects.companyContext.created") ?? "Target group created");
            } catch {
                // keep selection so user can retry
            } finally {
                setCreatingTgIds((prev) => { const n = new Set(prev); n.delete(index); return n; });
            }
        }
        await loadDetail(selectedId);
    }, [selectedId, selectedSuggestions, suggestions, loadDetail, t]);

    // Load prompt templates for selected project
    useEffect(() => {
        if (!selectedId) {
            setPromptTemplates([]);
            return;
        }
        let cancelled = false;
        setPromptTemplatesLoading(true);
        aiAssistApi
            .listTemplates(selectedId)
            .then((data) => {
                if (!cancelled) setPromptTemplates(data);
            })
            .catch(() => {
                if (!cancelled) setPromptTemplates([]);
            })
            .finally(() => {
                if (!cancelled) setPromptTemplatesLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [selectedId]);

    // In detail-mode, force-select the project from route to keep cookie/provider in sync.
    useEffect(() => {
        if (mode !== "detail") return;
        if (!activeProjectId) return;
        if (selectedId !== activeProjectId) {
            setSelectedId(activeProjectId);
        }
        // Ensure global project selection (cookie) matches the route.
        selectProject(activeProjectId);
    }, [mode, activeProjectId, selectedId, selectProject]);

    // Update projects list from provider
    useEffect(() => {
        // Prefer live projects from ProjectProvider (client fetch), fallback to initial SSR-props.
        // This makes the page resilient if the server-side prefetch fails.
        if (providerProjects.length > 0) {
            setProjects(providerProjects);
            return;
        }
        if (initialProjects.length > 0) {
            setProjects(initialProjects);
        }
    }, [providerProjects, initialProjects]);

    const roleOptions = [
        { value: "member", label: t("settingsProjects.roles.member") },
        { value: "admin", label: t("settingsProjects.roles.admin") },
    ];

    return (
        <div
            className="msqdx-glass-admin-grid"
            style={mode === "detail" ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}
        >
            {mode === "full" && (
                <MsqdxGlassCollapsiblePanel title={t("settingsProjects.title")} defaultExpanded={true}>
                    <section className="msqdx-glass-panel">
                    {/* Header with Refresh Button */}
                    <header className="msqdx-glass-panel__header">
                        <div>
                            <MsqdxTypography variant="h5" weight="semibold">
                                {t("settingsProjects.title")}
                            </MsqdxTypography>
                        </div>
                        <MsqdxButton
                            variant="text"
                            size="small"
                            onClick={refreshList}
                            disabled={listRefreshing}
                            startIcon={<MsqdxIcon name="refresh" customSize={16} />}
                        >
                            {t("personaAdmin.refresh")}
                        </MsqdxButton>
                    </header>

                    {/* Project List - Horizontal scrollable cards */}
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: { xs: "column", md: "row" },
                            gap: 1,
                            overflowX: { xs: "visible", md: "auto" },
                            pb: { md: 0.5 },
                            "&::-webkit-scrollbar": { height: 6 },
                            "&::-webkit-scrollbar-thumb": {
                                backgroundColor: "action.disabled",
                                borderRadius: 3,
                                "&:hover": { backgroundColor: "action.active" },
                            },
                        }}
                    >
                        {/* Create Project Card */}
                        {!showCreateForm && (
                            <MsqdxCard
                                clickable
                                onClick={() => setShowCreateForm(true)}
                                sx={{
                                    p: 2,
                                    minWidth: { xs: undefined, md: 220 },
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 1,
                                    border: "2px dashed",
                                    borderColor: "divider",
                                    "&:hover": {
                                        borderColor: accent,
                                        backgroundColor: "action.hover",
                                    },
                                }}
                            >
                                <MsqdxIcon name="add" customSize={24} sx={{ color: "text.secondary" }} />
                                <MsqdxTypography variant="subtitle2" weight="semibold" sx={{ color: "text.secondary" }}>
                                    {t("settingsProjects.createProject.title")}
                                </MsqdxTypography>
                            </MsqdxCard>
                        )}

                        {/* Create Project Form (inline) */}
                        {showCreateForm && (
                            <MsqdxCard
                                variant="flat"
                                sx={{
                                    p: 2,
                                    minWidth: { xs: undefined, md: 300 },
                                    border: "2px solid",
                                    borderColor: accent,
                                }}
                            >
                                <Stack spacing={1.5}>
                                    <MsqdxTypography variant="subtitle2" weight="semibold">
                                        {t("settingsProjects.createProject.title")}
                                    </MsqdxTypography>
                                    <MsqdxFormField
                                        label={t("settingsProjects.createProject.name")}
                                        value={newProjectName}
                                        onChange={(e) => setNewProjectName(e.target.value)}
                                        placeholder={t("settingsProjects.createProject.placeholder")}
                                        size="small"
                                        autoFocus
                                    />
                                    {createError && (
                                        <MsqdxTypography variant="caption" sx={{ color: "error.main" }}>
                                            {createError}
                                        </MsqdxTypography>
                                    )}
                                    <Stack direction="row" spacing={1}>
                                        <MsqdxButton
                                            variant="contained"
                                            size="small"
                                            onClick={handleCreateProject}
                                            disabled={creating}
                                            fullWidth
                                        >
                                            {creating ? t("settingsProjects.createProject.creating") : t("settingsProjects.createProject.cta")}
                                        </MsqdxButton>
                                        <MsqdxButton
                                            variant="outlined"
                                            size="small"
                                            onClick={() => {
                                                setShowCreateForm(false);
                                                setNewProjectName("");
                                                setCreateError(null);
                                            }}
                                            disabled={creating}
                                        >
                                            {t("common.cancel")}
                                        </MsqdxButton>
                                    </Stack>
                                </Stack>
                            </MsqdxCard>
                        )}

                        {/* Project Cards */}
                        {projects.length === 0 && !showCreateForm && (
                            <MsqdxTypography variant="body2" sx={{ color: "text.secondary", p: 2 }}>
                                {t("settingsProjects.yourProjects.empty")}
                            </MsqdxTypography>
                        )}
                        {projects.map((project) => (
                            <MsqdxCard
                                key={project.id}
                                variant="flat"
                                clickable
                                onClick={() => {
                                    setSelectedId(project.id);
                                    selectProject(project.id);
                                }}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setSelectedId(project.id);
                                        selectProject(project.id);
                                    }
                                }}
                                sx={{
                                    p: 1.5,
                                    minWidth: { xs: undefined, md: 220 },
                                    border: "1px solid",
                                    borderColor: selectedId === project.id ? accent : "divider",
                                    backgroundColor: selectedId === project.id ? "action.selected" : "background.paper",
                                    "&:hover": {
                                        borderColor: accent,
                                    },
                                }}
                            >
                                <MsqdxTypography variant="subtitle2" weight="semibold">
                                    {project.name}
                                </MsqdxTypography>
                                <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                                    {project.id}
                                </MsqdxTypography>
                                {selectedId === project.id && (
                                    <Box sx={{ mt: 0.5 }}>
                                        <MsqdxIcon name="check_circle" customSize={16} sx={{ color: accent }} />
                                    </Box>
                                )}
                            </MsqdxCard>
                        ))}
                    </Box>
                    </section>
                </MsqdxGlassCollapsiblePanel>
            )}

            {/* Detail Panel */}
            <section
                className="msqdx-glass-panel"
                style={mode === "detail" ? { gridColumn: "1 / -1" } : undefined}
            >
                {!selectedId && (
                    <Box sx={{ p: 3 }}>
                        <MsqdxTypography variant="body1" sx={{ color: "text.secondary" }}>
                            {t("settingsProjects.messages.selectProject") || "Select a project to view details"}
                        </MsqdxTypography>
                    </Box>
                )}

                {selectedId && detailLoading && (
                    <Box sx={{ p: 3 }}>
                        <MsqdxTypography variant="body1" sx={{ color: "text.secondary" }}>
                            {t("common.loading")}
                        </MsqdxTypography>
                    </Box>
                )}

                {selectedId && detailError && (
                    <Box sx={{ p: 3 }}>
                        <MsqdxTypography variant="body1" sx={{ color: "error.main" }}>
                            {detailError}
                        </MsqdxTypography>
                    </Box>
                )}

                {selectedId && detail && !detailLoading && (
                    <div className="msqdx-glass-detail">
                        <div className="msqdx-glass-dashboard-grid">
                            {/* Project Header Card */}
                            <Box sx={{ gridColumn: "1 / -1" }}>
                                <MsqdxCard>
                                    <MsqdxTypography variant="h4" weight="semibold" sx={{ mb: 0.5 }}>
                                        {detail.name}
                                    </MsqdxTypography>
                                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                                        {detail.id}
                                    </MsqdxTypography>
                                    <Box sx={{ display: "flex", gap: 2, mt: 2, flexWrap: "wrap" }}>
                                        <Box>
                                            <MsqdxTypography
                                                variant="caption"
                                                sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}
                                            >
                                                {t("settingsProjects.created") || "Created"}
                                            </MsqdxTypography>
                                            <MsqdxTypography variant="body2" weight="medium">
                                                {formatDate(detail.created_at)}
                                            </MsqdxTypography>
                                        </Box>
                                        <Box sx={{ borderLeft: "1px solid", borderColor: "divider", pl: 2 }}>
                                            <MsqdxTypography
                                                variant="caption"
                                                sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.25 }}
                                            >
                                                {t("settingsProjects.updated") || "Updated"}
                                            </MsqdxTypography>
                                            <MsqdxTypography variant="body2" weight="medium">
                                                {formatDate(detail.updated_at)}
                                            </MsqdxTypography>
                                        </Box>
                                    </Box>
                                </MsqdxCard>
                            </Box>

                            {/* Company Context / Unternehmenskontext */}
                            <Box sx={{ gridColumn: "1 / -1" }}>
                                <MsqdxDashboardCard
                                    id="company-context"
                                    title={t("settingsProjects.companyContext.title") ?? "Company & context"}
                                    icon="business"
                                    expanded={expandedSections.has("company-context")}
                                    onToggle={toggleSection}
                                >
                                    <Stack spacing={2}>
                                        <TextField
                                            label={t("settingsProjects.companyContext.description") ?? "Project / company description"}
                                            value={companyDescription}
                                            onChange={(e) => setCompanyDescription(e.target.value)}
                                            placeholder={t("settingsProjects.companyContext.descriptionPlaceholder") ?? "Short description of the project or company..."}
                                            multiline
                                            minRows={2}
                                            maxRows={6}
                                            size="small"
                                            fullWidth
                                            variant="outlined"
                                        />
                                        <TextField
                                            label={t("settingsProjects.companyContext.contextLabel") ?? "Company context"}
                                            value={companyContext}
                                            onChange={(e) => setCompanyContext(e.target.value)}
                                            placeholder={t("settingsProjects.companyContext.contextPlaceholder") ?? "Industry, products, target markets, tone of voice, etc. This context is used to suggest target groups and personas."}
                                            multiline
                                            minRows={3}
                                            maxRows={10}
                                            size="small"
                                            fullWidth
                                            variant="outlined"
                                        />
                                        {contextSaveError && (
                                            <MsqdxTypography variant="caption" sx={{ color: "error.main" }}>
                                                {contextSaveError}
                                            </MsqdxTypography>
                                        )}
                                        <MsqdxButton
                                            variant="contained"
                                            size="small"
                                            onClick={handleSaveCompanyContext}
                                            disabled={savingContext}
                                        >
                                            {savingContext ? (t("common.saving") ?? "Saving...") : (t("common.save") ?? "Save")}
                                        </MsqdxButton>
                                    </Stack>
                                </MsqdxDashboardCard>
                            </Box>

                            {/* Suggest target groups from context */}
                            <Box sx={{ gridColumn: "1 / -1" }}>
                                <MsqdxDashboardCard
                                    id="suggest-target-groups"
                                    title={t("settingsProjects.companyContext.suggestTitle") ?? "Suggest target groups from context"}
                                    icon="auto_awesome"
                                    expanded={expandedSections.has("suggest-target-groups")}
                                    onToggle={toggleSection}
                                >
                                    <Stack spacing={2}>
                                        <MsqdxButton
                                            variant="outlined"
                                            size="small"
                                            onClick={handleSuggestTargetGroups}
                                            disabled={suggestLoading || !(companyDescription.trim() || companyContext.trim())}
                                        >
                                            {suggestLoading ? (t("settingsProjects.companyContext.suggestLoading") ?? "Generating…") : (t("settingsProjects.companyContext.suggestCta") ?? "Generate suggestions")}
                                        </MsqdxButton>
                                        {!(companyDescription.trim() || companyContext.trim()) && (
                                            <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                                                {t("settingsProjects.companyContext.suggestEmpty") ?? "Save company context above first, then generate suggestions."}
                                            </MsqdxTypography>
                                        )}
                                        {suggestError && (
                                            <MsqdxTypography variant="caption" sx={{ color: "error.main" }}>
                                                {suggestError}
                                            </MsqdxTypography>
                                        )}
                                        {suggestions.length > 0 && (
                                            <>
                                                <Stack spacing={1}>
                                                    {suggestions.map((sg, i) => (
                                                        <Box
                                                            key={i}
                                                            sx={{
                                                                p: 1.5,
                                                                border: "1px solid",
                                                                borderColor: "divider",
                                                                borderRadius: 1,
                                                                display: "flex",
                                                                alignItems: "flex-start",
                                                                gap: 1,
                                                            }}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedSuggestions.has(i)}
                                                                onChange={() => toggleSuggestion(i)}
                                                                disabled={creatingTgIds.has(i)}
                                                            />
                                                            <Box sx={{ flex: 1 }}>
                                                                <MsqdxTypography variant="subtitle2" weight="semibold">
                                                                    {sg.name}
                                                                </MsqdxTypography>
                                                                <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                                                                    {sg.segment}
                                                                </MsqdxTypography>
                                                                {sg.description && (
                                                                    <MsqdxTypography variant="body2" sx={{ mt: 0.5 }}>
                                                                        {sg.description}
                                                                    </MsqdxTypography>
                                                                )}
                                                            </Box>
                                                            <MsqdxButton
                                                                variant="contained"
                                                                size="small"
                                                                disabled={creatingTgIds.has(i)}
                                                                onClick={() => handleCreateTargetGroups(new Set([i]))}
                                                            >
                                                                {creatingTgIds.has(i) ? "…" : (t("settingsProjects.companyContext.createOne") ?? "Create")}
                                                            </MsqdxButton>
                                                        </Box>
                                                    ))}
                                                </Stack>
                                                <MsqdxButton
                                                    variant="contained"
                                                    size="small"
                                                    disabled={selectedSuggestions.size === 0}
                                                    onClick={() => handleCreateTargetGroups()}
                                                >
                                                    {t("settingsProjects.companyContext.createSelected") ?? "Create selected"} ({selectedSuggestions.size})
                                                </MsqdxButton>
                                            </>
                                        )}
                                    </Stack>
                                </MsqdxDashboardCard>
                            </Box>

                            {/* Overview Stats Card */}
                            <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 6" } }}>
                                <MsqdxDashboardCard
                                    id="overview"
                                    title={t("settingsProjects.overview.title") || "Overview"}
                                    icon="dashboard"
                                    expanded={expandedSections.has("overview")}
                                    onToggle={toggleSection}
                                >
                                    <Stack spacing={2}>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                                                {t("settingsProjects.overview.personas") || "Personas"}
                                            </MsqdxTypography>
                                            <MsqdxTypography variant="h6" weight="semibold">
                                                {detail.stats.persona_count}
                                            </MsqdxTypography>
                                        </Box>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                                                {t("settingsProjects.overview.targetGroups") || "Target Groups"}
                                            </MsqdxTypography>
                                            <MsqdxTypography variant="h6" weight="semibold">
                                                {detail.stats.target_group_count}
                                            </MsqdxTypography>
                                        </Box>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                                                {t("settingsProjects.overview.members") || "Team Members"}
                                            </MsqdxTypography>
                                            <MsqdxTypography variant="h6" weight="semibold">
                                                {detail.members.length}
                                            </MsqdxTypography>
                                        </Box>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                                                {t("settingsProjects.overview.templates") || "Template Overrides"}
                                            </MsqdxTypography>
                                            <MsqdxTypography variant="h6" weight="semibold">
                                                {detail.stats.template_override_count}
                                            </MsqdxTypography>
                                        </Box>
                                    </Stack>
                                </MsqdxDashboardCard>
                            </Box>

                            {/* Team Members Card */}
                            <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 6" } }}>
                                <MsqdxDashboardCard
                                    id="members"
                                    title={t("settingsProjects.members.title")}
                                    icon="group"
                                    expanded={expandedSections.has("members")}
                                    onToggle={toggleSection}
                                >
                                    <Stack spacing={2}>
                                        {/* Add Member Form */}
                                        <Box sx={{ p: 2, backgroundColor: "action.hover", borderRadius: 1 }}>
                                            <Stack spacing={1.5}>
                                                <MsqdxFormField
                                                    label={t("settingsProjects.members.userEmail")}
                                                    value={memberEmail}
                                                    onChange={(e) => setMemberEmail(e.target.value)}
                                                    placeholder={t("settingsProjects.members.userEmailPlaceholder")}
                                                    size="small"
                                                />
                                                {memberError && (
                                                    <MsqdxTypography variant="caption" sx={{ color: "error.main" }}>
                                                        {memberError}
                                                    </MsqdxTypography>
                                                )}
                                                <MsqdxButton
                                                    variant="contained"
                                                    size="small"
                                                    onClick={handleAddMember}
                                                    disabled={updatingMembers}
                                                    fullWidth
                                                >
                                                    {t("settingsProjects.members.addMember")}
                                                </MsqdxButton>
                                            </Stack>
                                        </Box>

                                        {/* Members List */}
                                        {detail.members.length === 0 && (
                                            <MsqdxTypography variant="body2" sx={{ color: "text.secondary", textAlign: "center", py: 2 }}>
                                                {t("settingsProjects.members.none")}
                                            </MsqdxTypography>
                                        )}
                                        {detail.members.map((member) => (
                                            <Box
                                                key={member.id}
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    p: 1.5,
                                                    border: "1px solid",
                                                    borderColor: "divider",
                                                    borderRadius: 1,
                                                }}
                                            >
                                                <Box>
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
                                            </Box>
                                        ))}
                                    </Stack>
                                </MsqdxDashboardCard>
                            </Box>

                            {/* Personas Card */}
                            {detail.stats.persona_count > 0 && (
                                <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 6" } }}>
                                    <MsqdxDashboardCard
                                        id="personas"
                                        title={`${t("settingsProjects.personas.title") || "Personas"} (${detail.stats.persona_count})`}
                                        icon="person"
                                        expanded={expandedSections.has("personas")}
                                        onToggle={toggleSection}
                                    >
                                        <Stack spacing={1}>
                                            {detail.recent_personas?.map((persona) => (
                                                <Box
                                                    key={persona.id}
                                                    sx={{
                                                        p: 1.5,
                                                        border: "1px solid",
                                                        borderColor: "divider",
                                                        borderRadius: 1,
                                                    }}
                                                >
                                                    <MsqdxTypography variant="subtitle2" weight="semibold">
                                                        {persona.name}
                                                    </MsqdxTypography>
                                                    {persona.segment && (
                                                        <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                                                            {persona.segment}
                                                        </MsqdxTypography>
                                                    )}
                                                </Box>
                                            ))}
                                        </Stack>
                                    </MsqdxDashboardCard>
                                </Box>
                            )}

                            {/* Target Groups Card */}
                            {detail.stats.target_group_count > 0 && (
                                <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 6" } }}>
                                    <MsqdxDashboardCard
                                        id="target-groups"
                                        title={`${t("settingsProjects.targetGroups.title") || "Target Groups"} (${detail.stats.target_group_count})`}
                                        icon="groups"
                                        expanded={expandedSections.has("target-groups")}
                                        onToggle={toggleSection}
                                    >
                                        <Stack spacing={1}>
                                            {detail.recent_target_groups?.map((group) => (
                                                <Box
                                                    key={group.id}
                                                    sx={{
                                                        p: 1.5,
                                                        border: "1px solid",
                                                        borderColor: "divider",
                                                        borderRadius: 1,
                                                    }}
                                                >
                                                    <MsqdxTypography variant="subtitle2" weight="semibold">
                                                        {group.name}
                                                    </MsqdxTypography>
                                                    {group.segment && (
                                                        <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                                                            {group.segment}
                                                        </MsqdxTypography>
                                                    )}
                                                </Box>
                                            ))}
                                        </Stack>
                                    </MsqdxDashboardCard>
                                </Box>
                            )}

                            {/* Prompt Templates Card – always show when project is selected */}
                            <Box sx={{ gridColumn: "1 / -1" }}>
                                <MsqdxDashboardCard
                                    id="prompt-templates"
                                    title={t("settingsProjects.promptTemplates.title")}
                                    icon="psychology"
                                    expanded={expandedSections.has("prompt-templates")}
                                    onToggle={toggleSection}
                                >
                                    <Stack spacing={2}>
                                        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                                            <Link href={selectedId ? `/admin/projects/${selectedId}/prompts` : "#"} passHref legacyBehavior>
                                                <MsqdxButton
                                                    component="a"
                                                    variant="contained"
                                                    size="small"
                                                    startIcon={<MsqdxIcon name="edit" customSize={16} />}
                                                >
                                                    {t("settingsProjects.promptTemplates.manage")}
                                                </MsqdxButton>
                                            </Link>
                                        </Box>
                                        {promptTemplatesLoading && (
                                            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                                                {t("common.loading")}
                                            </MsqdxTypography>
                                        )}
                                        {!promptTemplatesLoading && promptTemplates.length === 0 && (
                                            <MsqdxTypography variant="body2" sx={{ color: "text.secondary", textAlign: "center", py: 2 }}>
                                                {t("settingsProjects.promptTemplates.empty")}
                                            </MsqdxTypography>
                                        )}
                                        {!promptTemplatesLoading && promptTemplates.length > 0 && (
                                            <Box
                                                sx={{
                                                    display: "grid",
                                                    gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
                                                    gap: 1.5,
                                                }}
                                            >
                                                {promptTemplates.map((template) => (
                                                    <Link
                                                        key={template.template_id}
                                                        href={`/admin/projects/${selectedId}/prompts?edit=${encodeURIComponent(template.template_id)}`}
                                                        passHref
                                                        legacyBehavior
                                                    >
                                                        <MsqdxCard
                                                            component="a"
                                                            variant="flat"
                                                            sx={{
                                                                p: 1.5,
                                                                border: "1px solid",
                                                                borderColor: "divider",
                                                                borderRadius: 1,
                                                                textDecoration: "none",
                                                                color: "inherit",
                                                                "&:hover": { borderColor: accent, backgroundColor: "action.hover" },
                                                            }}
                                                        >
                                                            <MsqdxTypography variant="subtitle2" weight="semibold">
                                                                {template.label}
                                                            </MsqdxTypography>
                                                            {template.description && (
                                                                <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
                                                                    {template.description}
                                                                </MsqdxTypography>
                                                            )}
                                                            <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.75 }}>
                                                                <MsqdxChip label={template.category} size="xs" variant="outlined" />
                                                                {template.default_model && (
                                                                    <MsqdxChip label={template.default_model} size="xs" variant="outlined" />
                                                                )}
                                                            </Stack>
                                                        </MsqdxCard>
                                                    </Link>
                                                ))}
                                            </Box>
                                        )}
                                    </Stack>
                                </MsqdxDashboardCard>
                            </Box>

                            {/* Legacy AI Templates (overrides) – optional summary when overrides exist */}
                            {detail.stats.template_override_count > 0 && (
                                <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 6" } }}>
                                    <MsqdxDashboardCard
                                        id="templates"
                                        title={`${t("settingsProjects.aiTemplates.title")} (${detail.stats.template_override_count})`}
                                        icon="tune"
                                        expanded={expandedSections.has("templates")}
                                        onToggle={toggleSection}
                                    >
                                        <Stack spacing={1}>
                                            {detail.template_overrides?.map((template) => (
                                                <Box
                                                    key={template.key}
                                                    sx={{
                                                        p: 1.5,
                                                        border: "1px solid",
                                                        borderColor: "divider",
                                                        borderRadius: 1,
                                                    }}
                                                >
                                                    <MsqdxTypography variant="subtitle2" weight="semibold">
                                                        {template.label}
                                                    </MsqdxTypography>
                                                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                                                        {template.key}
                                                    </MsqdxTypography>
                                                </Box>
                                            ))}
                                        </Stack>
                                    </MsqdxDashboardCard>
                                </Box>
                            )}
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}

MsqdxGlassProjectAdminPanel.displayName = "msqdx-glass-project-admin-panel";
