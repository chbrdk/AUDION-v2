"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useAuth } from "../auth/auth-provider";
import { clearProjectCookie, getProjectCookie, setProjectCookie } from "../../lib/project-cookies";
import { buildApiUrl } from "../../app/api/_lib/backend";
import { resolvePreferredProjectId } from "../../lib/project-selection";
import {
  persistPlatformCompanyIdFromUrl,
  resolvePlatformCompanyIdForApi,
} from "../../lib/platform-company-context";

export type ProjectSummary = {
  id: string;
  name: string;
  name_de?: string | null;
  owner_user_id: string;
  description?: string | null;
  description_de?: string | null;
  company_context?: string | null;
  company_context_de?: string | null;
  /** Linked CHECKION project for Deep Scan enrichment (optional). */
  checkion_project_id?: string | null;
  /** PLEXON platform project id when created or bound via central path. */
  platform_project_id?: string | null;
  /** PLEXON platform company id used when registering the project. */
  platform_company_id?: string | null;
  /** Publication lifecycle (`draft` | `published`). */
  status?: string;
  created_at: string;
  updated_at: string;
};

export type ProjectMember = {
  id: string;
  user_id: string;
  email: string;
  name?: string | null;
  role: string;
  status: string;
  created_at: string;
};

export type ProjectDetail = ProjectSummary & {
  members: ProjectMember[];
};

type ProjectContextValue = {
  projects: ProjectSummary[];
  activeProjectId: string | null;
  activeProject: ProjectSummary | null;
  selectProject: (projectId: string) => void;
  refreshProjects: () => Promise<void>;
  createProject: (name: string) => Promise<ProjectSummary>;
  getProjectDetail: (projectId: string) => Promise<ProjectDetail>;
  addMember: (projectId: string, payload: { email: string; role?: string }) => Promise<ProjectMember>;
  removeMember: (projectId: string, memberId: string) => Promise<void>;
};

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

const parseError = async (response: Response) => {
  try {
    const data = await response.json();
    return data.detail || data.error || response.statusText || "Request failed";
  } catch {
    return response.statusText || "Request failed";
  }
};

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading, defaultProjectId } = useAuth();
  const searchParams = useSearchParams();
  const launchProjectId = searchParams.get("projectId");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  // Start with cookie selection if present; otherwise remain unselected ("Select project").
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => getProjectCookie());

  const refreshProjects = useCallback(async () => {
    // While auth is still loading, do not clear cookie / state.
    if (authLoading) {
      return;
    }
    if (!user) {
      setProjects([]);
      setActiveProjectId(null);
      clearProjectCookie();
      return;
    }
    const response = await fetch(buildApiUrl("/api/projects"), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(await parseError(response));
    }
    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];
    setProjects(items);
    const projectIds = items.map((project: ProjectSummary) => project.id);
    const cookieProjectId = getProjectCookie();
    const nextProjectId = resolvePreferredProjectId(projectIds, {
      launchProjectId,
      activeProjectId,
      cookieProjectId,
      defaultProjectId,
    });

    if (!nextProjectId) {
      setActiveProjectId(null);
      clearProjectCookie();
      return;
    }

    setActiveProjectId(nextProjectId);
    if (nextProjectId === launchProjectId || nextProjectId === defaultProjectId) {
      setProjectCookie(nextProjectId);
    }
  }, [user, activeProjectId, authLoading, launchProjectId, defaultProjectId]);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    persistPlatformCompanyIdFromUrl(searchParams);
  }, [searchParams]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    const cookieProjectId = getProjectCookie();
    const nextProjectId = resolvePreferredProjectId(
      projects.map((project) => project.id),
      {
        launchProjectId,
        activeProjectId,
        cookieProjectId,
        defaultProjectId,
      }
    );
    if (nextProjectId && nextProjectId !== activeProjectId) {
      setActiveProjectId(nextProjectId);
      if (nextProjectId === launchProjectId || nextProjectId === defaultProjectId) {
        setProjectCookie(nextProjectId);
      }
    }
  }, [user, activeProjectId, authLoading, launchProjectId, projects, defaultProjectId]);

  const selectProject = useCallback((projectId: string) => {
    // Allow clearing selection (empty string) -> "Select project" state.
    if (!projectId) {
      setActiveProjectId(null);
      clearProjectCookie();
      return;
    }
    setActiveProjectId(projectId);
    setProjectCookie(projectId);
  }, []);

  const createProject = useCallback(async (name: string) => {
    const platformCompanyId = resolvePlatformCompanyIdForApi(searchParams);
    const body: Record<string, string> = { name };
    if (platformCompanyId) {
      body.platform_company_id = platformCompanyId;
    }
    const response = await fetch(buildApiUrl("/api/projects"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(await parseError(response));
    }
    const data = await response.json();
    return data as ProjectSummary;
  }, [searchParams]);

  const getProjectDetail = useCallback(async (projectId: string) => {
    const response = await fetch(buildApiUrl(`/api/projects/${projectId}`));
    if (!response.ok) {
      throw new Error(await parseError(response));
    }
    return (await response.json()) as ProjectDetail;
  }, []);

  const addMember = useCallback(async (projectId: string, payload: { email: string; role?: string }) => {
    const response = await fetch(buildApiUrl(`/api/projects/${projectId}/members`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await parseError(response));
    }
    return (await response.json()) as ProjectMember;
  }, []);

  const removeMember = useCallback(async (projectId: string, memberId: string) => {
    const response = await fetch(buildApiUrl(`/api/projects/${projectId}/members/${memberId}`), {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(await parseError(response));
    }
  }, []);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  const value = useMemo<ProjectContextValue>(
    () => ({
      projects,
      activeProjectId,
      activeProject,
      selectProject,
      refreshProjects,
      createProject,
      getProjectDetail,
      addMember,
      removeMember,
    }),
    [
      projects,
      activeProjectId,
      activeProject,
      selectProject,
      refreshProjects,
      createProject,
      getProjectDetail,
      addMember,
      removeMember,
    ]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};

export const useProject = (): ProjectContextValue => {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProject must be used within ProjectProvider");
  }
  return ctx;
};
