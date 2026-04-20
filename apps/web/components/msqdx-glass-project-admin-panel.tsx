"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Alert, Box, Stack } from "@mui/material";
import Link from "next/link";
import { MsqdxButton, MsqdxCard, MsqdxFormField, MsqdxTypography, MsqdxIcon, MsqdxDashboardCard, MsqdxChip, MsqdxSelect } from "@msqdx/react";
import { MsqdxGlassCollapsiblePanel } from "./admin/msqdx-glass-collapsible-panel";
import { buildApiUrl, fetchWithTimeout } from "../app/api/_lib/backend";
import { journeysApi, type JourneyResponse } from "../app/api/_lib/journeys";
import { withOutputLocale } from "../lib/ai-output-locale";
import { ADMIN_ROUTES } from "../lib/routes";
import { mirrorFillStringPair } from "../lib/bilingual-mirror";
import { isProjectAiContextEmpty } from "../lib/project-context";
import { aiAssistApi, type AiTemplateSummary } from "../app/api/_lib/ai-assist";
import { API_ROUTES } from "../lib/api-routes";
import { formatResearchTimelineDetail } from "../lib/format-research-timeline-detail";
import { useProject, type ProjectSummary, type ProjectMember } from "./projects/project-provider";
import { useI18n } from "./i18n/i18n-provider";

type ProjectDetail = {
    id: string;
    name: string;
    name_de?: string | null;
    description?: string | null;
    description_de?: string | null;
    company_context?: string | null;
    company_context_de?: string | null;
    status?: string;
    /** CHECKION project id for Deep Scan slim-page merge (optional). */
    checkion_project_id?: string | null;
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
    const { t, locale } = useI18n();
    const router = useRouter();
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

    // Deep-link from target-groups AI dialog: /admin/projects/{id}#company-context
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.location.hash !== "#company-context") return;
        if (!selectedId) return;
        if (detailLoading) return;
        setExpandedSections((prev) => {
            const next = new Set(prev);
            next.add("company-context");
            return next;
        });
        const timer = window.setTimeout(() => {
            document.getElementById("company-context")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
        return () => window.clearTimeout(timer);
    }, [selectedId, detailLoading]);

    // Deep-link: /admin/projects/{id}#project-research
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.location.hash !== "#project-research") return;
        if (!selectedId) return;
        if (detailLoading) return;
        setExpandedSections((prev) => {
            const next = new Set(prev);
            next.add("project-research");
            return next;
        });
        const timer = window.setTimeout(() => {
            document.getElementById("project-research")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
        return () => window.clearTimeout(timer);
    }, [selectedId, detailLoading]);

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
        new Set([
            "overview",
            "company-context",
            "project-research",
            "project-journeys",
            "suggest-target-groups",
            "suggest-personas",
            "members",
            "prompt-templates",
        ])
    );
    const projectResearchExpanded = useMemo(() => expandedSections.has("project-research"), [expandedSections]);
    const checkionSiteTopicsExpanded = useMemo(() => expandedSections.has("checkion-site-topics"), [expandedSections]);

    // Company context form state (synced from detail on load)
    const [companyDescription, setCompanyDescription] = useState("");
    const [companyContext, setCompanyContext] = useState("");
    const [companyDescriptionDe, setCompanyDescriptionDe] = useState("");
    const [companyContextDe, setCompanyContextDe] = useState("");
    const [projectNameEn, setProjectNameEn] = useState("");
    const [projectNameDe, setProjectNameDe] = useState("");
    const [projectPublicationStatus, setProjectPublicationStatus] = useState<"draft" | "published">("draft");
    const [savingContext, setSavingContext] = useState(false);

    // Project AI research state
    type ResearchEvent = {
        id: string;
        seq?: number | null;
        type: string;
        message?: string | null;
        payload?: any;
        created_at?: string | null;
    };
    const [researchSeedUrl, setResearchSeedUrl] = useState("");
    const [researchStarting, setResearchStarting] = useState(false);
    const [researchRunId, setResearchRunId] = useState<string | null>(null);
    const [researchStatus, setResearchStatus] = useState<string | null>(null);
    const [researchError, setResearchError] = useState<string | null>(null);
    const [researchPagesFetched, setResearchPagesFetched] = useState<number>(0);
    const [researchLatestLoading, setResearchLatestLoading] = useState(false);
    const [researchLatest, setResearchLatest] = useState<any | null>(null);
    const [researchEvents, setResearchEvents] = useState<ResearchEvent[]>([]);
    const [researchStreaming, setResearchStreaming] = useState(false);
    const [researchReconnecting, setResearchReconnecting] = useState(false);
    const [researchShowPages, setResearchShowPages] = useState(false);
    type CheckionProjectRow = { id: string; name: string; domain?: string | null };
    const [checkionRows, setCheckionRows] = useState<CheckionProjectRow[]>([]);
    const [checkionListLoading, setCheckionListLoading] = useState(false);
    const [checkionListError, setCheckionListError] = useState<string | null>(null);
    const [checkionProjectDraft, setCheckionProjectDraft] = useState("");
    const [savingCheckionLink, setSavingCheckionLink] = useState(false);
    const [checkionLinkSaveError, setCheckionLinkSaveError] = useState<string | null>(null);
    type CheckionSiteTopicRow = { tag: string; page_count: number; weight_sum: number; median_score?: number | null };
    type CheckionSiteTopicsPayload = {
        scan_id?: string | null;
        source?: string | null;
        topics?: CheckionSiteTopicRow[];
        pages_processed?: number;
        truncated?: boolean;
        seed_url_used?: string | null;
        unavailable_reason?: string | null;
    };
    const [siteTopicsPayload, setSiteTopicsPayload] = useState<CheckionSiteTopicsPayload | null>(null);
    const [siteTopicsLoading, setSiteTopicsLoading] = useState(false);
    const [siteTopicsError, setSiteTopicsError] = useState<string | null>(null);
    const lastResearchCursorRef = useRef<string | null>(null);
    const researchReconnectRef = useRef<number | null>(null);
    const researchCanLoadLatest = useMemo(() => {
        if (researchStatus === "succeeded") return true;
        return researchEvents.some((e) => e.type === "summary_saved");
    }, [researchEvents, researchStatus]);

    const researchPhase = useMemo(() => {
        const types = researchEvents.map((e) => e.type);
        if (types.includes("run_failed") || researchStatus === "failed") return "failed";
        if (types.includes("summary_saved") || researchStatus === "succeeded") return "done";
        if (types.includes("translate_start") || types.includes("translate_done")) return "translate";
        if (types.includes("synthesize_start") || types.includes("synthesize_done")) return "synthesize";
        if (types.includes("crawl_start") || types.includes("page_fetched") || types.includes("crawl_done")) return "crawl";
        if (researchStatus === "queued") return "queued";
        return "idle";
    }, [researchEvents, researchStatus]);

    const researchTimelineItems = useMemo(() => {
        const nonPage = researchEvents.filter((e) => e.type !== "page_fetched");
        const pageEvents = researchEvents.filter((e) => e.type === "page_fetched");
        const lastPage = pageEvents.length ? pageEvents[pageEvents.length - 1] : null;

        const items: Array<ResearchEvent & { __synthetic?: boolean }> = [];

        if (pageEvents.length) {
            items.push({
                id: "__pages_fetched__",
                seq: lastPage?.seq ?? null,
                type: "pages_fetched",
                message: `Fetched ${pageEvents.length} page${pageEvents.length === 1 ? "" : "s"}${lastPage?.payload?.url ? ` (latest: ${String(lastPage.payload.url)})` : ""}`,
                payload: { pages_fetched: pageEvents.length, latest_url: lastPage?.payload?.url },
                created_at: lastPage?.created_at ?? null,
                __synthetic: true,
            });
        }

        // Keep the most recent phase/state events, plus the synthetic pages summary above.
        const tail = nonPage.slice(-20);
        const pageTail = researchShowPages ? pageEvents.slice(-20) : [];
        return [...tail, ...items, ...pageTail];
    }, [researchEvents, researchShowPages]);

    const loadResearchLatest = useCallback(
        async (projectId: string) => {
            setResearchLatestLoading(true);
            setResearchError(null);
            try {
                const res = await fetch(buildApiUrl(API_ROUTES.projectResearchLatest(projectId)), { cache: "no-store" });
                if (!res.ok) {
                    const txt = await res.text().catch(() => "");
                    throw new Error(txt || res.statusText);
                }
                const data = await res.json();
                setResearchLatest(data);
                setResearchRunId(data?.run_id ?? null);
                setResearchStatus(data?.status ?? null);
            } catch (e) {
                setResearchLatest(null);
                setResearchError(e instanceof Error ? e.message : "Failed to load research");
            } finally {
                setResearchLatestLoading(false);
            }
        },
        []
    );

    // Stream research progress events (SSE) for the active run
    useEffect(() => {
        if (!selectedId || !researchRunId) return;

        let cancelled = false;
        let es: EventSource | null = null;

        const connect = (after: string | null) => {
            if (cancelled) return;
            if (researchReconnectRef.current) {
                window.clearTimeout(researchReconnectRef.current);
                researchReconnectRef.current = null;
            }

            const qs = new URLSearchParams({ run_id: researchRunId });
            if (after) qs.set("after", after);
            const url = buildApiUrl(API_ROUTES.projectResearchStream(selectedId, researchRunId, after));

            try {
                es = new EventSource(url);
            } catch {
                es = null;
            }
            if (!es) return;

            setResearchStreaming(true);
            setResearchReconnecting(false);
            es.addEventListener("progress", (evt) => {
                if (cancelled) return;
                try {
                    const parsed = JSON.parse(String((evt as MessageEvent).data ?? "{}"));
                    const next: ResearchEvent = {
                        id: String(parsed.id),
                        seq: typeof parsed.seq === "number" ? parsed.seq : null,
                        type: String(parsed.type),
                        message: parsed.message,
                        payload: parsed.payload,
                        created_at: parsed.created_at,
                    };
                    // Prefer seq for resume (strict ordering); fallback to id / timestamp.
                    lastResearchCursorRef.current =
                        (next.seq != null ? String(next.seq) : null) ||
                        next.id ||
                        next.created_at ||
                        lastResearchCursorRef.current;
                    setResearchEvents((prev) => {
                        if (prev.some((p) => p.id === next.id)) return prev;
                        return [...prev, next];
                    });
                    if (next.type === "page_fetched") {
                        const pages = Number(next.payload?.pages_fetched ?? NaN);
                        if (!Number.isNaN(pages)) setResearchPagesFetched(pages);
                    }
                    if (next.type === "summary_saved") {
                        void loadResearchLatest(selectedId);
                    }
                    if (next.type === "run_failed") {
                        const err =
                            next.payload && typeof next.payload === "object" && "error" in next.payload
                                ? (next.payload as { error?: unknown }).error
                                : undefined;
                        if (typeof err === "string" && err.trim()) setResearchError(err);
                    }
                } catch {
                    // ignore parse errors
                }
            });

            es.addEventListener("done", () => {
                if (cancelled) return;
                setResearchStreaming(false);
                setResearchReconnecting(false);
                try {
                    es?.close();
                } catch {
                    // ignore
                }
            });

            es.onerror = () => {
                if (cancelled) return;
                setResearchStreaming(false);
                setResearchReconnecting(true);
                try {
                    es?.close();
                } catch {
                    // ignore
                }
                const cursor = lastResearchCursorRef.current;
                researchReconnectRef.current = window.setTimeout(() => connect(cursor), 1500);
            };
        };

        // New run => reset stream state
        lastResearchCursorRef.current = null;
        setResearchEvents([]);
        setResearchReconnecting(false);
        connect(null);

        return () => {
            cancelled = true;
            try {
                es?.close();
            } catch {
                // ignore
            }
            if (researchReconnectRef.current) {
                window.clearTimeout(researchReconnectRef.current);
                researchReconnectRef.current = null;
            }
            setResearchStreaming(false);
            setResearchReconnecting(false);
        };
    }, [selectedId, researchRunId, loadResearchLatest]);

    const startResearch = useCallback(async () => {
        if (!selectedId) return;
        const seed = researchSeedUrl.trim();
        if (!seed) return;
        setResearchStarting(true);
        setResearchError(null);
        try {
            const res = await fetch(buildApiUrl(API_ROUTES.projectResearchStart(selectedId)), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ seed_url: seed, max_pages: 20, max_depth: 2 }),
            });
            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                throw new Error(txt || res.statusText);
            }
            const data = await res.json();
            setResearchRunId(data?.run_id ?? null);
            setResearchStatus(data?.status ?? null);
            setResearchPagesFetched(Number(data?.pages_fetched ?? 0));
            setResearchLatest(null);
        } catch (e) {
            setResearchError(e instanceof Error ? e.message : "Failed to start research");
        } finally {
            setResearchStarting(false);
        }
    }, [selectedId, researchSeedUrl]);

    // Poll research status while running
    useEffect(() => {
        if (!selectedId || !researchRunId) return;
        if (!researchStatus || !["queued", "running"].includes(String(researchStatus))) return;
        let cancelled = false;
        const tick = async () => {
            try {
                const res = await fetch(buildApiUrl(API_ROUTES.projectResearchStatus(selectedId, researchRunId)), {
                    cache: "no-store",
                });
                if (!res.ok) return;
                const data = await res.json();
                if (cancelled) return;
                setResearchStatus(data?.status ?? null);
                setResearchPagesFetched(Number(data?.pages_fetched ?? 0));
                if (data?.status === "failed" && typeof data?.error === "string" && data.error.trim()) {
                    setResearchError(data.error);
                }
                if (data?.status === "succeeded") {
                    void loadResearchLatest(selectedId);
                }
            } catch {
                // ignore polling errors
            }
        };
        const timer = window.setInterval(tick, 2500);
        void tick();
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [selectedId, researchRunId, researchStatus, loadResearchLatest]);

    useEffect(() => {
        setSiteTopicsPayload(null);
        setSiteTopicsError(null);
    }, [selectedId]);

    useEffect(() => {
        if (!selectedId || !checkionSiteTopicsExpanded) return;
        let cancelled = false;
        (async () => {
            setSiteTopicsLoading(true);
            setSiteTopicsError(null);
            try {
                const res = await fetch(buildApiUrl(API_ROUTES.projectCheckionSiteTopics(selectedId)), { cache: "no-store" });
                const data = (await res.json().catch(() => null)) as CheckionSiteTopicsPayload | { detail?: string } | null;
                if (cancelled) return;
                if (!res.ok) {
                    const msg =
                        typeof data === "object" && data && "detail" in data && typeof (data as { detail?: string }).detail === "string"
                            ? (data as { detail: string }).detail
                            : res.statusText;
                    setSiteTopicsError(msg);
                    setSiteTopicsPayload(null);
                    return;
                }
                setSiteTopicsPayload(data as CheckionSiteTopicsPayload);
            } catch (e) {
                if (!cancelled) {
                    setSiteTopicsError(e instanceof Error ? e.message : "Request failed");
                    setSiteTopicsPayload(null);
                }
            } finally {
                if (!cancelled) setSiteTopicsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedId, checkionSiteTopicsExpanded]);

    const hasCompanyContextForAi = useMemo(
        () =>
            Boolean(
                companyDescription.trim() ||
                    companyDescriptionDe.trim() ||
                    companyContext.trim() ||
                    companyContextDe.trim()
            ),
        [companyDescription, companyDescriptionDe, companyContext, companyContextDe]
    );

    const [contextSaveError, setContextSaveError] = useState<string | null>(null);

    // Suggest target groups state
    type TargetGroupSuggestion = { name: string; segment: string; description: string };
    const [suggestions, setSuggestions] = useState<TargetGroupSuggestion[]>([]);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const [suggestError, setSuggestError] = useState<string | null>(null);
    const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
    const [creatingTgIds, setCreatingTgIds] = useState<Set<number>>(new Set());

    // Suggest personas (per target group) state
    type PersonaSuggestionItem = { name: string; age?: string | null; headline: string; bio?: string; location?: string | null; gender?: string | null };
    type TargetGroupOption = { id: string; name: string; segment: string };
    const [projectTargetGroups, setProjectTargetGroups] = useState<TargetGroupOption[]>([]);
    const [selectedTgIdForPersonas, setSelectedTgIdForPersonas] = useState<string | null>(null);
    const [personaSuggestions, setPersonaSuggestions] = useState<PersonaSuggestionItem[]>([]);
    const [selectedPersonaSuggestions, setSelectedPersonaSuggestions] = useState<Set<number>>(new Set());
    const [personaSuggestLoading, setPersonaSuggestLoading] = useState(false);
    const [personaSuggestError, setPersonaSuggestError] = useState<string | null>(null);
    const [creatingPersonaIndices, setCreatingPersonaIndices] = useState<Set<number>>(new Set());
    const [enrichingPersonaIds, setEnrichingPersonaIds] = useState<Set<string>>(new Set());

    // Generate journey from project knowledge state
    const [selectedTgIdForJourney, setSelectedTgIdForJourney] = useState<string | null>(null);
    const [journeyType, setJourneyType] = useState<string>("customer_journey");
    const [generateJourneyLoading, setGenerateJourneyLoading] = useState(false);
    const [generateJourneyError, setGenerateJourneyError] = useState<string | null>(null);
    const [generateJourneySuccess, setGenerateJourneySuccess] = useState<string | null>(null);

    // Project journeys overview
    const [projectJourneys, setProjectJourneys] = useState<JourneyResponse[]>([]);
    const [projectJourneysLoading, setProjectJourneysLoading] = useState(false);
    const [projectJourneysError, setProjectJourneysError] = useState<string | null>(null);
    const [showAllProjectJourneys, setShowAllProjectJourneys] = useState(false);
    const PROJECT_JOURNEYS_PREVIEW_LIMIT = 3;

    // Prompt templates for this project (full list for cards)
    const [promptTemplates, setPromptTemplates] = useState<AiTemplateSummary[]>([]);
    const [promptTemplatesLoading, setPromptTemplatesLoading] = useState(false);

    const checkionSelectOptions = useMemo(
        () => [
            { value: "", label: t("settingsProjects.projectResearch.checkionAuto") },
            ...checkionRows.map((r) => ({
                value: r.id,
                label: r.domain ? `${r.name} (${r.domain})` : r.name,
            })),
        ],
        [checkionRows, t]
    );

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
                    name_de: basicDetail.name_de ?? null,
                    description: basicDetail.description ?? null,
                    description_de: basicDetail.description_de ?? null,
                    company_context: basicDetail.company_context ?? null,
                    company_context_de: basicDetail.company_context_de ?? null,
                    status: basicDetail.status ?? "draft",
                    checkion_project_id: basicDetail.checkion_project_id ?? null,
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
            const response = await fetchWithTimeout(buildApiUrl(`/api/projects`), { cache: "no-store" });
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
            setCompanyDescriptionDe(detail.description_de ?? "");
            setCompanyContextDe(detail.company_context_de ?? "");
            setProjectNameEn(detail.name ?? "");
            setProjectNameDe(detail.name_de ?? "");
            const st = detail.status === "published" ? "published" : "draft";
            setProjectPublicationStatus(st);
        }
    }, [
        detail?.id,
        detail?.name,
        detail?.description,
        detail?.company_context,
        detail?.description_de,
        detail?.company_context_de,
        detail?.name_de,
        detail?.status,
    ]);

    useEffect(() => {
        if (!detail) {
            setCheckionProjectDraft("");
            return;
        }
        const v = detail.checkion_project_id?.trim();
        setCheckionProjectDraft(v || "");
    }, [detail?.id, detail?.checkion_project_id]);

    useEffect(() => {
        if (!selectedId || !projectResearchExpanded) return;
        let cancelled = false;
        setCheckionListLoading(true);
        setCheckionListError(null);
        void fetch(buildApiUrl(API_ROUTES.checkionProjects), { cache: "no-store" })
            .then(async (res) => {
                if (!res.ok) {
                    const body = await res.text().catch(() => "");
                    throw new Error(body || res.statusText);
                }
                return res.json() as Promise<{ items?: CheckionProjectRow[] }>;
            })
            .then((data) => {
                if (cancelled) return;
                setCheckionRows(Array.isArray(data.items) ? data.items : []);
            })
            .catch((e) => {
                if (!cancelled) {
                    setCheckionListError(e instanceof Error ? e.message : "CHECKION list failed");
                    setCheckionRows([]);
                }
            })
            .finally(() => {
                if (!cancelled) setCheckionListLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [selectedId, projectResearchExpanded]);

    // Save company context (PATCH project)
    const handleSaveCompanyContext = useCallback(async () => {
        if (!selectedId) return;
        setSavingContext(true);
        setContextSaveError(null);
        try {
            const namePair = mirrorFillStringPair(projectNameEn, projectNameDe);
            const descPair = mirrorFillStringPair(companyDescription, companyDescriptionDe);
            const ctxPair = mirrorFillStringPair(companyContext, companyContextDe);
            const nameEnFinal = (namePair.en.trim() || detail?.name?.trim() || "").trim();
            const res = await fetch(buildApiUrl(`/api/projects/${selectedId}`), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: nameEnFinal || undefined,
                    description: descPair.en.trim() || null,
                    company_context: ctxPair.en.trim() || null,
                    description_de: descPair.de.trim() || null,
                    company_context_de: ctxPair.de.trim() || null,
                    name_de: namePair.de.trim() || null,
                    status: projectPublicationStatus,
                }),
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
    }, [
        selectedId,
        companyDescription,
        companyContext,
        companyDescriptionDe,
        companyContextDe,
        projectNameEn,
        projectNameDe,
        projectPublicationStatus,
        detail?.name,
        loadDetail,
        t,
    ]);

    const handleSaveCheckionLink = useCallback(async () => {
        if (!selectedId) return;
        setSavingCheckionLink(true);
        setCheckionLinkSaveError(null);
        try {
            const res = await fetch(buildApiUrl(`/api/projects/${selectedId}`), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ checkion_project_id: checkionProjectDraft.trim() || "" }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                const msg = typeof err.detail === "string" ? err.detail : res.statusText;
                throw new Error(msg ?? "Save failed");
            }
            await loadDetail(selectedId);
            notify(t("settingsProjects.projectResearch.checkionSaved") ?? "CHECKION link saved");
        } catch (e) {
            setCheckionLinkSaveError(e instanceof Error ? e.message : "Save failed");
        } finally {
            setSavingCheckionLink(false);
        }
    }, [selectedId, checkionProjectDraft, loadDetail, t]);

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
                body: JSON.stringify(withOutputLocale({ max_suggestions: 5 }, locale)),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                const msg = Array.isArray(err.detail) ? err.detail[0]?.msg ?? err.detail : err.detail;
                throw new Error(msg ?? res.statusText ?? "Suggest failed");
            }
            const data = await res.json();
            const list = data.suggestions ?? [];
            setSuggestions(list);
            if (list.length === 0) {
                setSuggestError(t("settingsProjects.companyContext.suggestEmpty") ?? "Save company context above first, then generate suggestions.");
            } else {
                setSuggestError(null);
            }
        } catch (e) {
            setSuggestError(e instanceof Error ? e.message : "Suggest failed");
        } finally {
            setSuggestLoading(false);
        }
    }, [selectedId, locale, t]);

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

    // Fetch target groups for persona suggestions and generate-journey dropdowns when section is expanded
    useEffect(() => {
        if (!selectedId || (!expandedSections.has("suggest-personas") && !expandedSections.has("generate-journey"))) return;
        let cancelled = false;
        fetchWithTimeout(buildApiUrl(`/api/target-groups?project_id=${encodeURIComponent(selectedId)}&page_size=100`), { cache: "no-store" })
            .then(async (res) => {
                if (!res.ok) {
                    const errBody = await res.text().catch(() => res.statusText || "Unknown error");
                    console.error("Target groups load failed:", res.status, errBody);
                    notify(t("settingsProjects.targetGroupsLoadError") + (errBody ? ` ${errBody.slice(0, 80)}` : ""));
                    return { items: [] };
                }
                return res.json();
            })
            .then((data) => {
                if (!cancelled && data.items) {
                    setProjectTargetGroups(
                        data.items.map((tg: { id: string; name?: string; segment?: string }) => ({
                            id: tg.id,
                            name: tg.name || "",
                            segment: tg.segment || "",
                        }))
                    );
                }
            })
            .catch((err) => {
                console.error("Target groups fetch error:", err);
                if (!cancelled) {
                    setProjectTargetGroups([]);
                    notify(t("settingsProjects.targetGroupsLoadError"));
                }
            });
        return () => {
            cancelled = true;
        };
    }, [selectedId, expandedSections]);

    // Load project journeys when "project-journeys" section is expanded (or after generating a journey)
    useEffect(() => {
        if (!selectedId || !expandedSections.has("project-journeys")) return;
        let cancelled = false;
        setProjectJourneysLoading(true);
        setProjectJourneysError(null);
        journeysApi
            .listJourneys({ project_id: selectedId, page: 1, page_size: 50 })
            .then((data) => {
                if (!cancelled) {
                    setProjectJourneys(Array.isArray(data) ? data : []);
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    setProjectJourneys([]);
                    setProjectJourneysError(e instanceof Error ? e.message : "Failed to load journeys");
                }
            })
            .finally(() => {
                if (!cancelled) setProjectJourneysLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [selectedId, expandedSections, generateJourneySuccess]);

    // Reset "show all journeys" when switching project
    useEffect(() => {
        setShowAllProjectJourneys(false);
    }, [selectedId]);

    const handleSuggestPersonas = useCallback(async () => {
        if (!selectedId || !selectedTgIdForPersonas) return;
        setPersonaSuggestLoading(true);
        setPersonaSuggestError(null);
        setPersonaSuggestions([]);
        setSelectedPersonaSuggestions(new Set());
        try {
            const res = await fetch(
                buildApiUrl(`/api/target-groups/${selectedTgIdForPersonas}/suggest-personas`),
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(withOutputLocale({ max_suggestions: 5 }, locale)),
                }
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                const msg = Array.isArray(err.detail) ? err.detail[0]?.msg ?? err.detail : err.detail;
                throw new Error(typeof msg === "string" ? msg : res.statusText ?? "Suggest failed");
            }
            const data = await res.json();
            const list = data.suggestions ?? [];
            setPersonaSuggestions(list);
            if (list.length === 0) {
                setPersonaSuggestError(t("settingsProjects.suggestPersonas.noSuggestions") ?? "No suggestions.");
            } else {
                setPersonaSuggestError(null);
            }
        } catch (e) {
            setPersonaSuggestError(e instanceof Error ? e.message : "Suggest failed");
        } finally {
            setPersonaSuggestLoading(false);
        }
    }, [selectedId, selectedTgIdForPersonas, locale, t]);

    const togglePersonaSuggestion = useCallback((index: number) => {
        setSelectedPersonaSuggestions((prev) => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    }, []);

    const handleCreatePersonas = useCallback(
        async (indices?: Set<number>, doEnrich?: boolean) => {
            const toCreate = indices ?? selectedPersonaSuggestions;
            if (!selectedId || !selectedTgIdForPersonas || toCreate.size === 0) return;
            const tg = projectTargetGroups.find((g) => g.id === selectedTgIdForPersonas);
            const segment = tg?.segment ?? "";
            const toCreateList = Array.from(toCreate).map((i) => ({ index: i, ...personaSuggestions[i] }));
            for (const { index, name, headline, bio, age, location, gender } of toCreateList) {
                setCreatingPersonaIndices((prev) => new Set(prev).add(index));
                try {
                    const createRes = await fetch(buildApiUrl("/api/personas"), {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            project_id: selectedId,
                            target_group_id: selectedTgIdForPersonas,
                            name,
                            segment: segment || "Segment",
                            headline: headline || name,
                        }),
                    });
                    if (!createRes.ok) {
                        const errBody = await createRes.json().catch(() => ({}));
                        throw new Error(typeof errBody.detail === "string" ? errBody.detail : "Create failed");
                    }
                    const created = await createRes.json();
                    const personaId = created?.id;
                    if (personaId && (bio || age || location || gender)) {
                        await fetch(buildApiUrl(`/api/persona-admin/${personaId}`), {
                            method: "PATCH",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                profile: {
                                    bio: bio || "",
                                    age: age ?? null,
                                    location: location ?? null,
                                    gender: gender ?? null,
                                },
                            }),
                        });
                    }
                    const profileOverlay = { bio: bio || "", age: age ?? null, location: location ?? null, gender: gender ?? null };
                    if (doEnrich && personaId) {
                        setEnrichingPersonaIds((prev) => new Set(prev).add(personaId));
                        try {
                            const enrichRes = await fetch(buildApiUrl(`/api/personas/${personaId}/enrich`), {
                                method: "POST",
                                credentials: "include",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(withOutputLocale({ profile_overlay: profileOverlay }, locale)),
                            });
                            if (!enrichRes.ok) throw new Error("Enrich failed");
                        } finally {
                            setEnrichingPersonaIds((prev) => {
                                const n = new Set(prev);
                                n.delete(personaId);
                                return n;
                            });
                        }
                    }
                    setSelectedPersonaSuggestions((prev) => {
                        const n = new Set(prev);
                        n.delete(index);
                        return n;
                    });
                    setPersonaSuggestions((prev) => prev.filter((_, i) => i !== index));
                    notify(t("settingsProjects.suggestPersonas.created") ?? "Persona created");
                } catch {
                    // keep selection for retry
                } finally {
                    setCreatingPersonaIndices((prev) => {
                        const n = new Set(prev);
                        n.delete(index);
                        return n;
                    });
                }
            }
            await loadDetail(selectedId);
        },
        [
            selectedId,
            selectedTgIdForPersonas,
            selectedPersonaSuggestions,
            personaSuggestions,
            projectTargetGroups,
            loadDetail,
            locale,
            t,
        ]
    );

    const handleGenerateJourney = useCallback(async () => {
        if (!selectedId) return;
        setGenerateJourneyLoading(true);
        setGenerateJourneyError(null);
        setGenerateJourneySuccess(null);
        try {
            const res = await fetch(buildApiUrl(`/api/projects/${selectedId}/generate-journey`), {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    withOutputLocale(
                        {
                            target_group_id: selectedTgIdForJourney || null,
                            journey_type: journeyType || "customer_journey",
                            organization_id: selectedId,
                        },
                        locale
                    )
                ),
            });
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || "Generate journey failed");
            }
            const data = await res.json();
            setGenerateJourneySuccess(data?.id ?? "ok");
            notify(t("settingsProjects.generateJourney.success") ?? "Journey created");
        } catch (e) {
            setGenerateJourneyError(e instanceof Error ? e.message : "Generate journey failed");
        } finally {
            setGenerateJourneyLoading(false);
        }
    }, [selectedId, selectedTgIdForJourney, journeyType, locale, t]);

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
                            <Box className="msqdx-dashboard-project-header" sx={{ gridColumn: "1 / -1" }}>
                                <MsqdxCard>
                                    <MsqdxTypography variant="h4" weight="semibold" sx={{ mb: 0.5 }}>
                                        {locale === "de" && (detail.name_de?.trim() || "").length > 0
                                            ? detail.name_de
                                            : detail.name}
                                    </MsqdxTypography>
                                    {locale === "de" && detail.name_de?.trim() && detail.name !== detail.name_de ? (
                                        <MsqdxTypography variant="caption" sx={{ color: "text.secondary", mb: 0.5, display: "block" }}>
                                            EN: {detail.name}
                                        </MsqdxTypography>
                                    ) : null}
                                    {locale === "en" && detail.name_de?.trim() ? (
                                        <MsqdxTypography variant="caption" sx={{ color: "text.secondary", mb: 0.5, display: "block" }}>
                                            DE: {detail.name_de}
                                        </MsqdxTypography>
                                    ) : null}
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

                            {/* Overview + Team Members: 50/50 row directly under meta card */}
                            <Box
                                sx={{
                                    gridColumn: "1 / -1",
                                    display: "grid",
                                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                                    gap: 2,
                                    alignItems: "stretch",
                                }}
                            >
                                <Box sx={{ minWidth: 0 }}>
                                    <MsqdxDashboardCard
                                        id="overview"
                                        title={t("settingsProjects.overview.title") || "Overview"}
                                        icon="dashboard"
                                        expanded={expandedSections.has("overview")}
                                        onToggle={toggleSection}
                                    >
                                        <Box
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
                                                gap: 2,
                                            }}
                                        >
                                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", py: 0.5 }}>
                                                <MsqdxTypography variant="h6" weight="semibold">
                                                    {detail.stats.persona_count}
                                                </MsqdxTypography>
                                                <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                                                    {t("settingsProjects.overview.personas") || "Personas"}
                                                </MsqdxTypography>
                                            </Box>
                                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", py: 0.5 }}>
                                                <MsqdxTypography variant="h6" weight="semibold">
                                                    {detail.stats.target_group_count}
                                                </MsqdxTypography>
                                                <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                                                    {t("settingsProjects.overview.targetGroups") || "Target Groups"}
                                                </MsqdxTypography>
                                            </Box>
                                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", py: 0.5 }}>
                                                <MsqdxTypography variant="h6" weight="semibold">
                                                    {detail.members.length}
                                                </MsqdxTypography>
                                                <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                                                    {t("settingsProjects.overview.members") || "Team Members"}
                                                </MsqdxTypography>
                                            </Box>
                                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", py: 0.5 }}>
                                                <MsqdxTypography variant="h6" weight="semibold">
                                                    {detail.stats.template_override_count}
                                                </MsqdxTypography>
                                                <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                                                    {t("settingsProjects.overview.templates") || "Template Overrides"}
                                                </MsqdxTypography>
                                            </Box>
                                        </Box>
                                    </MsqdxDashboardCard>
                                </Box>
                                <Box sx={{ minWidth: 0 }}>
                                    <MsqdxDashboardCard
                                        id="members"
                                        title={t("settingsProjects.members.title")}
                                        icon="group"
                                        expanded={expandedSections.has("members")}
                                        onToggle={toggleSection}
                                    >
                                        <Stack spacing={2}>
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
                                        {isProjectAiContextEmpty(
                                            companyDescription,
                                            companyContext,
                                            companyDescriptionDe,
                                            companyContextDe
                                        ) && (
                                            <Alert severity="info" sx={{ alignItems: "flex-start" }}>
                                                {t("settingsProjects.companyContext.emptyAiHint")}
                                            </Alert>
                                        )}
                                        <MsqdxSelect
                                            label={t("settingsProjects.companyContext.publicationLabel") ?? "Publication status"}
                                            value={projectPublicationStatus}
                                            onChange={(e) =>
                                                setProjectPublicationStatus(
                                                    e.target.value === "published" ? "published" : "draft"
                                                )
                                            }
                                            options={[
                                                {
                                                    value: "draft",
                                                    label: t("settingsProjects.companyContext.draft") ?? "Draft",
                                                },
                                                {
                                                    value: "published",
                                                    label: t("settingsProjects.companyContext.published") ?? "Published",
                                                },
                                            ]}
                                            size="small"
                                            sx={{ maxWidth: 360 }}
                                        />
                                        <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mt: -1 }}>
                                            {t("settingsProjects.companyContext.publicationHint") ??
                                                "Published requires German (DE) fields wherever English text is set."}
                                        </MsqdxTypography>
                                        <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                                            {t("settingsProjects.companyContext.mirrorSaveHint")}
                                        </MsqdxTypography>
                                        <MsqdxFormField
                                            label={t("settingsProjects.companyContext.displayNameLabel")}
                                            value={locale === "de" ? projectNameDe : projectNameEn}
                                            onChange={(e) =>
                                                locale === "de"
                                                    ? setProjectNameDe(e.target.value)
                                                    : setProjectNameEn(e.target.value)
                                            }
                                            placeholder={t("settingsProjects.companyContext.displayNameLabel")}
                                            size="small"
                                            fullWidth
                                        />
                                        <MsqdxFormField
                                            label={t("settingsProjects.companyContext.description") ?? "Project / company description"}
                                            value={locale === "de" ? companyDescriptionDe : companyDescription}
                                            onChange={(e) =>
                                                locale === "de"
                                                    ? setCompanyDescriptionDe(e.target.value)
                                                    : setCompanyDescription(e.target.value)
                                            }
                                            placeholder={t("settingsProjects.companyContext.descriptionPlaceholder") ?? "Short description of the project or company..."}
                                            multiline
                                            minRows={2}
                                            maxRows={6}
                                            size="small"
                                            fullWidth
                                        />
                                        <MsqdxFormField
                                            label={t("settingsProjects.companyContext.contextLabel") ?? "Company context"}
                                            value={locale === "de" ? companyContextDe : companyContext}
                                            onChange={(e) =>
                                                locale === "de" ? setCompanyContextDe(e.target.value) : setCompanyContext(e.target.value)
                                            }
                                            placeholder={t("settingsProjects.companyContext.contextPlaceholder") ?? "Industry, products, target markets, tone of voice, etc. This context is used to suggest target groups and personas."}
                                            multiline
                                            minRows={3}
                                            maxRows={10}
                                            size="small"
                                            fullWidth
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

                            {/* Project AI Research */}
                            <Box sx={{ gridColumn: "1 / -1" }}>
                                <MsqdxDashboardCard
                                    id="project-research"
                                    title={t("settingsProjects.projectResearch.title") ?? "AI Research"}
                                    icon="auto_awesome"
                                    expanded={expandedSections.has("project-research")}
                                    onToggle={toggleSection}
                                >
                                    <Stack spacing={2}>
                                        <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                                            {t("settingsProjects.projectResearch.subtitle")}
                                        </MsqdxTypography>

                                        <Stack spacing={1}>
                                            <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                                                {t("settingsProjects.projectResearch.checkionHint")}
                                            </MsqdxTypography>
                                            <MsqdxSelect
                                                label={t("settingsProjects.projectResearch.checkionLabel")}
                                                value={checkionProjectDraft}
                                                onChange={(e) => setCheckionProjectDraft(String((e.target as EventTarget & { value: string }).value))}
                                                options={checkionSelectOptions}
                                                disabled={checkionListLoading || !selectedId}
                                                size="small"
                                            />
                                            {checkionListLoading && (
                                                <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                                                    {t("settingsProjects.projectResearch.checkionLoadingList")}
                                                </MsqdxTypography>
                                            )}
                                            {checkionListError && (
                                                <MsqdxTypography variant="caption" sx={{ color: "warning.main" }}>
                                                    {checkionListError}
                                                </MsqdxTypography>
                                            )}
                                            {checkionLinkSaveError && (
                                                <MsqdxTypography variant="caption" sx={{ color: "error.main" }}>
                                                    {checkionLinkSaveError}
                                                </MsqdxTypography>
                                            )}
                                            <MsqdxButton
                                                variant="outlined"
                                                size="small"
                                                onClick={() => void handleSaveCheckionLink()}
                                                disabled={savingCheckionLink || !selectedId}
                                            >
                                                {savingCheckionLink
                                                    ? t("settingsProjects.projectResearch.savingCheckionLink")
                                                    : t("settingsProjects.projectResearch.saveCheckionLink")}
                                            </MsqdxButton>
                                        </Stack>

                                        <MsqdxFormField
                                            label={t("settingsProjects.projectResearch.seedUrlLabel")}
                                            value={researchSeedUrl}
                                            onChange={(e) => setResearchSeedUrl(e.target.value)}
                                            placeholder={t("settingsProjects.projectResearch.seedUrlPlaceholder")}
                                            size="small"
                                            fullWidth
                                        />

                                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                                            <MsqdxButton
                                                variant="contained"
                                                size="small"
                                                brandColor="green"
                                                onClick={startResearch}
                                                disabled={researchStarting || !selectedId || !researchSeedUrl.trim()}
                                                startIcon={<MsqdxIcon name="auto_awesome" customSize={16} />}
                                            >
                                                {researchStarting
                                                    ? t("settingsProjects.projectResearch.starting")
                                                    : t("settingsProjects.projectResearch.start")}
                                            </MsqdxButton>
                                            <MsqdxButton
                                                variant="outlined"
                                                size="small"
                                                onClick={() => (selectedId ? loadResearchLatest(selectedId) : undefined)}
                                                disabled={researchLatestLoading || !selectedId || !researchCanLoadLatest}
                                            >
                                                {researchLatestLoading
                                                    ? t("settingsProjects.projectResearch.loadingLatest")
                                                    : t("settingsProjects.projectResearch.viewLatest")}
                                            </MsqdxButton>
                                        </Stack>

                                        <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                                            {researchRunId
                                                ? `Run: ${researchRunId} · status=${researchStatus ?? "—"} · pages=${researchPagesFetched}`
                                                : t("settingsProjects.projectResearch.noRuns")}
                                        </MsqdxTypography>

                                        {researchRunId ? (
                                            <Box
                                                sx={{
                                                    border: "1px solid",
                                                    borderColor: "divider",
                                                    borderRadius: 1,
                                                    p: 1.5,
                                                    bgcolor: "rgba(0,0,0,0.02)",
                                                }}
                                            >
                                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                                    <MsqdxChip
                                                        size="small"
                                                        label={
                                                            researchStreaming
                                                                ? (t("settingsProjects.projectResearch.streaming") ?? "Live")
                                                                : (t("settingsProjects.projectResearch.notStreaming") ?? "Not live")
                                                        }
                                                        color={researchStreaming ? "success" : "default"}
                                                    />
                                                    <MsqdxChip
                                                        size="small"
                                                        label={
                                                            researchPhase === "crawl"
                                                                ? (t("settingsProjects.projectResearch.phaseCrawl") ?? "Crawl")
                                                                : researchPhase === "synthesize"
                                                                  ? (t("settingsProjects.projectResearch.phaseSynthesize") ?? "Synthesize")
                                                                  : researchPhase === "translate"
                                                                    ? (t("settingsProjects.projectResearch.phaseTranslate") ?? "Translate")
                                                                    : researchPhase === "done"
                                                                      ? (t("settingsProjects.projectResearch.phaseDone") ?? "Done")
                                                                      : researchPhase === "failed"
                                                                        ? (t("settingsProjects.projectResearch.phaseFailed") ?? "Failed")
                                                                        : researchPhase === "queued"
                                                                          ? (t("settingsProjects.projectResearch.phaseQueued") ?? "Queued")
                                                                          : "—"
                                                        }
                                                        color={
                                                            researchPhase === "failed"
                                                                ? "error"
                                                                : researchPhase === "done"
                                                                  ? "success"
                                                                  : researchPhase === "queued"
                                                                    ? "warning"
                                                                    : "default"
                                                        }
                                                    />
                                                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                                                        {t("settingsProjects.projectResearch.progressTimeline") ?? "Progress"}
                                                    </MsqdxTypography>
                                                    <MsqdxButton
                                                        variant="text"
                                                        size="small"
                                                        onClick={() => setResearchShowPages((v) => !v)}
                                                    >
                                                        {researchShowPages
                                                            ? (t("settingsProjects.projectResearch.hidePages") ?? "Hide pages")
                                                            : (t("settingsProjects.projectResearch.showPages") ?? "Show pages")}
                                                    </MsqdxButton>
                                                </Stack>
                                                {researchReconnecting ? (
                                                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
                                                        {t("settingsProjects.projectResearch.reconnecting") ?? "Reconnecting…"}
                                                    </MsqdxTypography>
                                                ) : null}
                                                {researchTimelineItems.length ? (
                                                    <Stack spacing={0.75}>
                                                        {researchTimelineItems.map((e) => (
                                                            <Stack key={e.id} direction="row" spacing={1} sx={{ minWidth: 0 }}>
                                                                <MsqdxTypography
                                                                    variant="caption"
                                                                    sx={{ color: "text.secondary", minWidth: 110 }}
                                                                >
                                                                    {e.type === "pages_fetched"
                                                                        ? (t("settingsProjects.projectResearch.crawlProgress") ?? "Crawl progress")
                                                                        : e.type}
                                                                </MsqdxTypography>
                                                                <MsqdxTypography
                                                                    variant="caption"
                                                                    sx={{ color: "text.primary", minWidth: 0, wordBreak: "break-word" }}
                                                                >
                                                                    {formatResearchTimelineDetail(e)}
                                                                </MsqdxTypography>
                                                            </Stack>
                                                        ))}
                                                    </Stack>
                                                ) : (
                                                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                                                        {t("settingsProjects.projectResearch.waitingForEvents") ??
                                                            "Waiting for progress updates..."}
                                                    </MsqdxTypography>
                                                )}
                                            </Box>
                                        ) : null}

                                        {researchError ? (
                                            <MsqdxTypography variant="caption" sx={{ color: "error.main" }}>
                                                {researchError}
                                            </MsqdxTypography>
                                        ) : null}

                                        {researchLatest ? (
                                            <Box
                                                sx={{
                                                    border: "1px solid",
                                                    borderColor: "divider",
                                                    borderRadius: 1,
                                                    p: 1.5,
                                                    bgcolor: "rgba(0,0,0,0.02)",
                                                }}
                                            >
                                                <MsqdxTypography variant="subtitle2" weight="semibold" sx={{ mb: 1 }}>
                                                    {t("settingsProjects.projectResearch.viewLatest")}
                                                </MsqdxTypography>
                                                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                                                    {JSON.stringify(
                                                        locale === "de" && researchLatest.summary_de
                                                            ? researchLatest.summary_de
                                                            : researchLatest.summary_en,
                                                        null,
                                                        2
                                                    )}
                                                </pre>
                                            </Box>
                                        ) : null}
                                    </Stack>
                                </MsqdxDashboardCard>
                            </Box>

                            <Box sx={{ gridColumn: "1 / -1" }}>
                                <MsqdxDashboardCard
                                    id="checkion-site-topics"
                                    title={t("settingsProjects.projectResearch.siteTopicsTitle") ?? "Site topics (CHECKION)"}
                                    icon="label"
                                    expanded={expandedSections.has("checkion-site-topics")}
                                    onToggle={toggleSection}
                                >
                                    <Stack spacing={1.5}>
                                        <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                                            {t("settingsProjects.projectResearch.siteTopicsSubtitle") ??
                                                "Aggregated page tags from the latest Deep Scan. Loaded when you expand this section."}
                                        </MsqdxTypography>
                                        {siteTopicsLoading ? (
                                            <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                                                {t("settingsProjects.projectResearch.siteTopicsLoading") ?? "Loading topics…"}
                                            </MsqdxTypography>
                                        ) : null}
                                        {siteTopicsError ? (
                                            <MsqdxTypography variant="caption" sx={{ color: "error.main" }}>
                                                {siteTopicsError}
                                            </MsqdxTypography>
                                        ) : null}
                                        {!siteTopicsLoading && siteTopicsPayload?.unavailable_reason ? (
                                            <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                                                {siteTopicsPayload.unavailable_reason === "checkion_not_configured"
                                                    ? (t("settingsProjects.projectResearch.siteTopicsReasonNotConfigured") ??
                                                      "CHECKION is not configured on the server.")
                                                    : siteTopicsPayload.unavailable_reason === "no_seed_url"
                                                      ? (t("settingsProjects.projectResearch.siteTopicsReasonNoSeed") ??
                                                        "No seed URL: run AI research once or pass a company URL so the server can resolve the domain.")
                                                      : siteTopicsPayload.unavailable_reason === "no_scan_or_empty_slim_pages"
                                                        ? (t("settingsProjects.projectResearch.siteTopicsReasonNoScan") ??
                                                          "No scan data or empty slim-pages for this project/domain.")
                                                        : siteTopicsPayload.unavailable_reason === "no_tags_in_slim_pages"
                                                          ? (t("settingsProjects.projectResearch.siteTopicsReasonNoTags") ??
                                                            "Slim-pages were loaded but no page tags (pageClassification) were present. Update CHECKION so DB slim-pages include classification, or re-run classification on the scan.")
                                                          : siteTopicsPayload.unavailable_reason}
                                            </MsqdxTypography>
                                        ) : null}
                                        {!siteTopicsLoading &&
                                        siteTopicsPayload &&
                                        !siteTopicsPayload.unavailable_reason &&
                                        (siteTopicsPayload.topics?.length ?? 0) === 0 ? (
                                            <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                                                {t("settingsProjects.projectResearch.siteTopicsEmpty") ?? "No topic tags found."}
                                            </MsqdxTypography>
                                        ) : null}
                                        {!siteTopicsLoading &&
                                        siteTopicsPayload &&
                                        !siteTopicsPayload.unavailable_reason &&
                                        (siteTopicsPayload.topics?.length ?? 0) > 0 ? (
                                            <>
                                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ gap: 0.75 }}>
                                                    <MsqdxChip
                                                        size="small"
                                                        label={`scan: ${siteTopicsPayload.scan_id ?? "—"}`}
                                                        variant="outlined"
                                                    />
                                                    <MsqdxChip
                                                        size="small"
                                                        label={`source: ${siteTopicsPayload.source ?? "—"}`}
                                                        variant="outlined"
                                                    />
                                                    {siteTopicsPayload.truncated ? (
                                                        <MsqdxChip
                                                            size="small"
                                                            color="warning"
                                                            label={t("settingsProjects.projectResearch.siteTopicsTruncated") ?? "Truncated"}
                                                        />
                                                    ) : null}
                                                    <MsqdxChip
                                                        size="small"
                                                        variant="outlined"
                                                        label={`pages: ${siteTopicsPayload.pages_processed ?? 0}`}
                                                    />
                                                </Stack>
                                                {siteTopicsPayload.seed_url_used ? (
                                                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary", wordBreak: "break-all" }}>
                                                        {t("settingsProjects.projectResearch.siteTopicsSeedUsed") ?? "Seed URL used"}:{" "}
                                                        {siteTopicsPayload.seed_url_used}
                                                    </MsqdxTypography>
                                                ) : null}
                                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                                                    {(siteTopicsPayload.topics ?? []).map((row) => (
                                                        <MsqdxChip
                                                            key={row.tag}
                                                            size="small"
                                                            label={`${row.tag} · ${row.page_count}p · w${row.weight_sum}`}
                                                        />
                                                    ))}
                                                </Box>
                                            </>
                                        ) : null}
                                    </Stack>
                                </MsqdxDashboardCard>
                            </Box>

                            {/* Three action cards: brand background, black text, outline buttons black */}
                            <Box
                                className="msqdx-glass-dashboard-grid-three-cols msqdx-dashboard-action-cards"
                                sx={{
                                    gridColumn: "1 / -1",
                                    display: "grid",
                                    gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                                    gap: 2,
                                    alignItems: "stretch",
                                }}
                            >
                            <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
                                <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                                <MsqdxDashboardCard
                                    id="suggest-target-groups"
                                    title={t("settingsProjects.companyContext.suggestTitle") ?? "Suggest target groups from context"}
                                    icon="auto_awesome"
                                    expanded={expandedSections.has("suggest-target-groups")}
                                    onToggle={toggleSection}
                                >
                                    <Stack spacing={2}>
                                        <MsqdxButton
                                            className="msqdx-action-card-outlined-btn"
                                            variant="outlined"
                                            size="small"
                                            onClick={handleSuggestTargetGroups}
                                            disabled={suggestLoading || !hasCompanyContextForAi}
                                            sx={{ color: "#000", borderColor: "#000", "&:hover": { borderColor: "#000", color: "#000", backgroundColor: "rgba(0,0,0,0.08)" } }}
                                        >
                                            {suggestLoading ? (t("settingsProjects.companyContext.suggestLoading") ?? "Generating…") : (t("settingsProjects.companyContext.suggestCta") ?? "Generate suggestions")}
                                        </MsqdxButton>
                                        {!hasCompanyContextForAi && (
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
                                                                className="msqdx-dashboard-list-checkbox"
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
                            </Box>

                            <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
                                <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                                <MsqdxDashboardCard
                                    id="suggest-personas"
                                    title={t("settingsProjects.suggestPersonas.title") ?? "Suggest personas for target group"}
                                    icon="person_search"
                                    expanded={expandedSections.has("suggest-personas")}
                                    onToggle={toggleSection}
                                >
                                    <Stack spacing={2}>
                                        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
                                            <MsqdxSelect
                                                label={t("settingsProjects.suggestPersonas.selectTargetGroup") ?? "Select target group"}
                                                value={selectedTgIdForPersonas ?? ""}
                                                onChange={(e) => {
                                                    setSelectedTgIdForPersonas((e.target.value as string) || null);
                                                    setPersonaSuggestions([]);
                                                    setPersonaSuggestError(null);
                                                }}
                                                options={[
                                                    { value: "", label: "—" },
                                                    ...projectTargetGroups.map((tg) => ({
                                                        value: tg.id,
                                                        label: tg.name || tg.segment || tg.id,
                                                    })),
                                                ]}
                                                size="small"
                                                borderColor="black"
                                                sx={{ minWidth: 200 }}
                                            />
                                            <MsqdxButton
                                                className="msqdx-action-card-outlined-btn"
                                                variant="outlined"
                                                size="small"
                                                onClick={handleSuggestPersonas}
                                                disabled={
                                                    personaSuggestLoading ||
                                                    !selectedTgIdForPersonas ||
                                                    !hasCompanyContextForAi
                                                }
                                                sx={{ color: "#000", borderColor: "#000", "&:hover": { borderColor: "#000", color: "#000", backgroundColor: "rgba(0,0,0,0.08)" } }}
                                            >
                                                {personaSuggestLoading
                                                    ? (t("settingsProjects.suggestPersonas.loading") ?? "Generating…")
                                                    : (t("settingsProjects.suggestPersonas.cta") ?? "Generate persona suggestions")}
                                            </MsqdxButton>
                                        </Box>
                                        {!hasCompanyContextForAi && (
                                            <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                                                {t("settingsProjects.suggestPersonas.empty") ?? "Save company context above and select a target group."}
                                            </MsqdxTypography>
                                        )}
                                        {personaSuggestError && (
                                            <MsqdxTypography variant="caption" sx={{ color: "error.main" }}>
                                                {personaSuggestError}
                                            </MsqdxTypography>
                                        )}
                                        {personaSuggestions.length > 0 && (
                                            <>
                                                <Stack spacing={1}>
                                                    {personaSuggestions.map((ps, i) => (
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
                                                                className="msqdx-dashboard-list-checkbox"
                                                                checked={selectedPersonaSuggestions.has(i)}
                                                                onChange={() => togglePersonaSuggestion(i)}
                                                                disabled={creatingPersonaIndices.has(i)}
                                                            />
                                                            <Box sx={{ flex: 1 }}>
                                                                <MsqdxTypography variant="subtitle2" weight="semibold">
                                                                    {ps.name}
                                                                    {ps.age || ps.location ? ` · ${[ps.age, ps.location].filter(Boolean).join(", ")}` : ""}
                                                                </MsqdxTypography>
                                                                <MsqdxTypography variant="body2" sx={{ fontStyle: "italic" }}>
                                                                    {ps.headline}
                                                                </MsqdxTypography>
                                                                {ps.bio && (
                                                                    <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
                                                                        {ps.bio}
                                                                    </MsqdxTypography>
                                                                )}
                                                            </Box>
                                                            <MsqdxButton
                                                                className="msqdx-action-card-outlined-btn"
                                                                variant="outlined"
                                                                size="small"
                                                                disabled={creatingPersonaIndices.has(i)}
                                                                onClick={() => handleCreatePersonas(new Set([i]), false)}
                                                                sx={{ color: "#000", borderColor: "#000", "&:hover": { borderColor: "#000", color: "#000", backgroundColor: "rgba(0,0,0,0.08)" } }}
                                                            >
                                                                {creatingPersonaIndices.has(i) ? "…" : (t("settingsProjects.suggestPersonas.createOne") ?? "Create")}
                                                            </MsqdxButton>
                                                            <MsqdxButton
                                                                variant="contained"
                                                                size="small"
                                                                disabled={creatingPersonaIndices.has(i)}
                                                                onClick={() => handleCreatePersonas(new Set([i]), true)}
                                                            >
                                                                {creatingPersonaIndices.has(i) ? "…" : (t("settingsProjects.suggestPersonas.createAndEnrich") ?? "Create & enrich")}
                                                            </MsqdxButton>
                                                        </Box>
                                                    ))}
                                                </Stack>
                                                <MsqdxButton
                                                    variant="contained"
                                                    size="small"
                                                    disabled={selectedPersonaSuggestions.size === 0}
                                                    onClick={() => handleCreatePersonas(undefined, true)}
                                                >
                                                    {t("settingsProjects.suggestPersonas.createSelected") ?? "Create selected"} ({selectedPersonaSuggestions.size}) + enrich
                                                </MsqdxButton>
                                            </>
                                        )}
                                    </Stack>
                                </MsqdxDashboardCard>
                                </Box>
                            </Box>

                            <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
                                <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                                <MsqdxDashboardCard
                                    id="generate-journey"
                                    title={t("settingsProjects.generateJourney.title") ?? "Generate journey from project knowledge"}
                                    icon="route"
                                    expanded={expandedSections.has("generate-journey")}
                                    onToggle={toggleSection}
                                >
                                    <Stack spacing={2}>
                                        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
                                            <MsqdxSelect
                                                label={t("settingsProjects.generateJourney.selectTargetGroup") ?? "Target group (optional)"}
                                                value={selectedTgIdForJourney ?? ""}
                                                onChange={(e) => {
                                                    setSelectedTgIdForJourney((e.target.value as string) || null);
                                                    setGenerateJourneyError(null);
                                                }}
                                                options={[
                                                    { value: "", label: t("settingsProjects.generateJourney.targetGroupOptional") ?? "— None —" },
                                                    ...projectTargetGroups.map((tg) => ({
                                                        value: tg.id,
                                                        label: tg.name || tg.segment || tg.id,
                                                    })),
                                                ]}
                                                size="small"
                                                borderColor="black"
                                                sx={{ minWidth: 200 }}
                                            />
                                            <MsqdxFormField
                                                label={t("settingsProjects.generateJourney.journeyType") ?? "Journey type"}
                                                value={journeyType}
                                                onChange={(e) => setJourneyType(e.target.value)}
                                                placeholder="customer_journey"
                                                size="small"
                                                sx={{ minWidth: 200 }}
                                            />
                                        </Box>
                                        {generateJourneyError && (
                                            <MsqdxTypography variant="caption" sx={{ color: "error.main" }}>
                                                {generateJourneyError}
                                            </MsqdxTypography>
                                        )}
                                        {generateJourneySuccess && (
                                            <MsqdxTypography variant="caption" sx={{ color: "success.main" }}>
                                                {t("settingsProjects.generateJourney.success") ?? "Journey created."}
                                                {generateJourneySuccess !== "ok" && (
                                                    <>
                                                        {" "}
                                                        <Link href={ADMIN_ROUTES.journeyDetail(generateJourneySuccess)} style={{ marginLeft: 4 }}>
                                                            {t("settingsProjects.generateJourney.viewJourney") ?? "View journey"}
                                                        </Link>
                                                    </>
                                                )}
                                            </MsqdxTypography>
                                        )}
                                        <MsqdxButton
                                            variant="contained"
                                            size="small"
                                            onClick={() => handleGenerateJourney()}
                                            disabled={generateJourneyLoading}
                                            sx={{ backgroundColor: "#000", color: "#fff", "&:hover": { backgroundColor: "rgba(0,0,0,0.85)", color: "#fff" } }}
                                        >
                                            {generateJourneyLoading
                                                ? (t("settingsProjects.generateJourney.loading") ?? "Generating…")
                                                : (t("settingsProjects.generateJourney.cta") ?? "Generate journey")}
                                        </MsqdxButton>
                                    </Stack>
                                </MsqdxDashboardCard>
                                </Box>
                            </Box>
                            </Box>

                            {/* Project journeys, Personas, Target Groups – 3 columns, equal height */}
                            <Box
                                className="msqdx-glass-dashboard-grid-three-cols"
                                sx={{
                                    gridColumn: "1 / -1",
                                    display: "grid",
                                    gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                                    gap: 2,
                                    alignItems: "stretch",
                                }}
                            >
                            <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
                                <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                                <MsqdxDashboardCard
                                    id="project-journeys"
                                    title={t("settingsProjects.projectJourneys.title") ?? "Journeys in this project"}
                                    icon="route"
                                    expanded={expandedSections.has("project-journeys")}
                                    onToggle={toggleSection}
                                >
                                    <Stack spacing={2}>
                                        {projectJourneysLoading && (
                                            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                                                {t("journeys.loading") ?? "Loading…"}
                                            </MsqdxTypography>
                                        )}
                                        {projectJourneysError && (
                                            <MsqdxTypography variant="body2" sx={{ color: "error.main" }}>
                                                {projectJourneysError}
                                            </MsqdxTypography>
                                        )}
                                        {!projectJourneysLoading && !projectJourneysError && projectJourneys.length === 0 && (
                                            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                                                {t("settingsProjects.projectJourneys.empty") ?? "No journeys yet. Create one above or go to Journeys."}
                                            </MsqdxTypography>
                                        )}
                                        {!projectJourneysLoading && projectJourneys.length > 0 && (
                                            <>
                                            <Box
                                                className="msqdx-dashboard-journey-list"
                                                sx={{
                                                    display: "grid",
                                                    gridTemplateColumns: "1fr",
                                                    gap: 1.5,
                                                }}
                                            >
                                                {(showAllProjectJourneys ? projectJourneys : projectJourneys.slice(0, PROJECT_JOURNEYS_PREVIEW_LIMIT)).map((journey) => (
                                                    <MsqdxCard
                                                        key={journey.id}
                                                        clickable
                                                        onClick={() => window.open(ADMIN_ROUTES.journeyDetail(journey.id), "_self")}
                                                        sx={{
                                                            p: 1.5,
                                                            border: "1px solid",
                                                            borderColor: "divider",
                                                            "&:hover": { borderColor: "primary.main" },
                                                        }}
                                                    >
                                                        <Stack spacing={0.5}>
                                                            <MsqdxTypography variant="subtitle2" weight="semibold">
                                                                {journey.name}
                                                            </MsqdxTypography>
                                                            <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                                                                {journey.description || (t("journeys.type", { type: journey.journey_type }) ?? journey.journey_type)}
                                                            </MsqdxTypography>
                                                            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
                                                                <MsqdxChip
                                                                    variant="outlined"
                                                                    size="small"
                                                                    label={t("journeys.phases", { count: journey.phases?.length ?? 0 }) ?? `${journey.phases?.length ?? 0} phases`}
                                                                />
                                                                <MsqdxChip variant="outlined" size="small" label={journey.journey_type} />
                                                            </Box>
                                                            <MsqdxButton
                                                                variant="text"
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    router.push(ADMIN_ROUTES.journeyDetail(journey.id));
                                                                }}
                                                                sx={{ mt: 0.5, alignSelf: "flex-start", fontSize: "0.75rem" }}
                                                            >
                                                                {t("settingsProjects.projectJourneys.view") ?? "View journey"} →
                                                            </MsqdxButton>
                                                        </Stack>
                                                    </MsqdxCard>
                                                ))}
                                            </Box>
                                            {projectJourneys.length > PROJECT_JOURNEYS_PREVIEW_LIMIT && (
                                                <MsqdxButton
                                                    variant="text"
                                                    size="small"
                                                    onClick={() => setShowAllProjectJourneys((prev) => !prev)}
                                                    sx={{ mt: 1, alignSelf: "flex-start" }}
                                                >
                                                    {showAllProjectJourneys
                                                        ? (t("settingsProjects.projectJourneys.showLess") ?? "Show less")
                                                        : (t("settingsProjects.projectJourneys.showAll", { count: projectJourneys.length }) ?? `Show all (${projectJourneys.length})`)}
                                                </MsqdxButton>
                                            )}
                                            </>
                                        )}
                                        <MsqdxButton
                                            variant="outlined"
                                            size="small"
                                            onClick={() => router.push(ADMIN_ROUTES.journeys)}
                                        >
                                            {t("settingsProjects.projectJourneys.allJourneys") ?? "All journeys"} →
                                        </MsqdxButton>
                                    </Stack>
                                </MsqdxDashboardCard>
                                </Box>
                            </Box>

                            <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
                                <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                                <MsqdxDashboardCard
                                    id="personas"
                                    title={`${t("settingsProjects.personas.title") || "Personas"} (${detail.stats.persona_count})`}
                                    icon="person"
                                    expanded={expandedSections.has("personas")}
                                    onToggle={toggleSection}
                                >
                                    <Stack spacing={1}>
                                        {detail.stats.persona_count === 0 ? (
                                            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                                                {t("settingsProjects.personas.empty") ?? t("adminDashboard.noPersonas") ?? "No personas yet."}
                                            </MsqdxTypography>
                                        ) : (
                                            detail.recent_personas?.map((persona) => (
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
                                            ))
                                        )}
                                    </Stack>
                                </MsqdxDashboardCard>
                                </Box>
                            </Box>

                            <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
                                <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                                <MsqdxDashboardCard
                                    id="target-groups"
                                    title={`${t("settingsProjects.targetGroups.title") || "Target Groups"} (${detail.stats.target_group_count})`}
                                    icon="groups"
                                    expanded={expandedSections.has("target-groups")}
                                    onToggle={toggleSection}
                                >
                                    <Stack spacing={1}>
                                        {detail.stats.target_group_count === 0 ? (
                                            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                                                {t("settingsProjects.targetGroups.empty") ?? t("adminDashboard.noTargetGroups") ?? "No target groups yet."}
                                            </MsqdxTypography>
                                        ) : (
                                            detail.recent_target_groups?.map((group) => (
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
                                            ))
                                        )}
                                    </Stack>
                                </MsqdxDashboardCard>
                                </Box>
                            </Box>
                            </Box>

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
                                                className="msqdx-dashboard-prompt-templates-list"
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
