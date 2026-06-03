"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { buildApiUrl } from "../app/api/_lib/backend";
import { fetchTargetGroupPersonas } from "../app/api/_lib/target-group";
import { targetGroupsApi } from "../app/api/_lib/target-groups";
import { useProject } from "../components/projects/project-provider";
import { normalizePersonaListResponse } from "./persona-list-normalize";
import { ADMIN_ROUTES } from "./routes";
import {
  PERSONA_V2_DEFAULT_SECTION,
  isPersonaV2SectionId,
  type PersonaV2SectionId,
} from "./persona-v2-sections";
import {
  TARGET_GROUP_V2_DEFAULT_SECTION,
  isTargetGroupV2SectionId,
  type TargetGroupV2SectionId,
} from "./target-group-v2-sections";

type PickerOption = { value: string; label: string };

function parsePersonaV2Path(pathname: string | null | undefined) {
  if (!pathname?.startsWith("/admin/personas-v2")) {
    return { personaId: null as string | null, sectionId: null as PersonaV2SectionId | null };
  }
  const match = pathname.match(/^\/admin\/personas-v2\/([^/]+)(?:\/([^/]+))?/);
  const sectionRaw = match?.[2] ?? null;
  return {
    personaId: match?.[1] ?? null,
    sectionId: sectionRaw && isPersonaV2SectionId(sectionRaw) ? sectionRaw : null,
  };
}

function parseTargetGroupV2Path(pathname: string | null | undefined) {
  if (!pathname?.startsWith("/admin/target-groups-v2")) {
    return { targetGroupId: null as string | null, sectionId: null as TargetGroupV2SectionId | null };
  }
  const match = pathname.match(/^\/admin\/target-groups-v2\/([^/]+)(?:\/([^/]+))?/);
  const sectionRaw = match?.[2] ?? null;
  const id = match?.[1] ?? null;
  return {
    targetGroupId: id && id !== "undefined" ? id : null,
    sectionId: sectionRaw && isTargetGroupV2SectionId(sectionRaw) ? sectionRaw : null,
  };
}

export function useAdminHeaderV2Context() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeProjectId, selectProject } = useProject();
  const { personaId, sectionId: personaSectionId } = useMemo(
    () => parsePersonaV2Path(pathname),
    [pathname]
  );
  const { targetGroupId: targetGroupIdFromPath, sectionId: targetGroupSectionId } = useMemo(
    () => parseTargetGroupV2Path(pathname),
    [pathname]
  );
  const isTargetGroupV2Route = Boolean(pathname?.startsWith("/admin/target-groups-v2"));

  const [targetGroups, setTargetGroups] = useState<PickerOption[]>([]);
  const [personas, setPersonas] = useState<PickerOption[]>([]);
  const [resolvedTargetGroupId, setResolvedTargetGroupId] = useState("");
  const [overviewTargetGroupId, setOverviewTargetGroupId] = useState("");
  const [loadingTargetGroups, setLoadingTargetGroups] = useState(false);
  const [loadingPersonas, setLoadingPersonas] = useState(false);

  const activeTargetGroupId = isTargetGroupV2Route
    ? targetGroupIdFromPath ?? overviewTargetGroupId
    : personaId
      ? resolvedTargetGroupId
      : overviewTargetGroupId;
  const activeSectionId = personaSectionId ?? PERSONA_V2_DEFAULT_SECTION;
  const activeTargetGroupSectionId = targetGroupSectionId ?? TARGET_GROUP_V2_DEFAULT_SECTION;

  useEffect(() => {
    if (!personaId || isTargetGroupV2Route) {
      setResolvedTargetGroupId("");
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(buildApiUrl(`/api/persona-admin/${encodeURIComponent(personaId)}`), {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          metadata?: { projectId?: string; targetGroupId?: string | null };
          profile?: { name?: string; targetGroupId?: string };
        };
        if (cancelled) return;
        const projectId = data.metadata?.projectId?.trim() ?? "";
        const targetGroupId =
          data.metadata?.targetGroupId?.trim() ??
          data.profile?.targetGroupId?.trim() ??
          "";
        if (projectId && projectId !== activeProjectId) {
          selectProject(projectId);
        }
        setResolvedTargetGroupId(targetGroupId);
      } catch {
        if (!cancelled) setResolvedTargetGroupId("");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [personaId, activeProjectId, selectProject, isTargetGroupV2Route]);

  useEffect(() => {
    if (!activeProjectId) {
      setTargetGroups([]);
      return;
    }
    let cancelled = false;
    setLoadingTargetGroups(true);
    targetGroupsApi
      .listTargetGroups({ project_id: activeProjectId, page_size: 200 })
      .then((res) => {
        if (cancelled) return;
        setTargetGroups(
          (res.items ?? []).map((tg) => ({
            value: tg.id,
            label: tg.name?.trim() || tg.id,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setTargetGroups([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTargetGroups(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  useEffect(() => {
    if (!personaId && !isTargetGroupV2Route) {
      setOverviewTargetGroupId("");
    }
  }, [activeProjectId, personaId, isTargetGroupV2Route]);

  useEffect(() => {
    if (!activeTargetGroupId) {
      setPersonas([]);
      return;
    }
    let cancelled = false;
    setLoadingPersonas(true);
    fetchTargetGroupPersonas(activeTargetGroupId, undefined, undefined, 1, 100)
      .then((res) => {
        if (cancelled) return;
        const normalized = normalizePersonaListResponse(res);
        setPersonas(
          (normalized.items ?? []).map((p) => ({
            value: p.id,
            label: p.name?.trim() || p.headline?.trim() || p.id,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setPersonas([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPersonas(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTargetGroupId]);

  const handleTargetGroupChange = useCallback(
    (nextTargetGroupId: string) => {
      if (isTargetGroupV2Route) {
        if (!nextTargetGroupId) {
          router.push(ADMIN_ROUTES.targetGroupsV2);
          return;
        }
        if (targetGroupIdFromPath) {
          router.push(
            ADMIN_ROUTES.targetGroupV2Section(nextTargetGroupId, activeTargetGroupSectionId)
          );
          return;
        }
        setOverviewTargetGroupId(nextTargetGroupId);
        return;
      }

      if (!personaId) {
        setOverviewTargetGroupId(nextTargetGroupId);
        return;
      }
      if (!nextTargetGroupId) {
        router.push(ADMIN_ROUTES.personasV2);
        return;
      }
      void fetchTargetGroupPersonas(nextTargetGroupId, undefined, undefined, 1, 100)
        .then((res) => {
          const first = normalizePersonaListResponse(res).items?.[0]?.id;
          if (first) {
            router.push(ADMIN_ROUTES.personaV2Section(first, activeSectionId));
          } else {
            router.push(ADMIN_ROUTES.personasV2);
          }
        })
        .catch(() => {
          router.push(ADMIN_ROUTES.personasV2);
        });
    },
    [
      isTargetGroupV2Route,
      targetGroupIdFromPath,
      activeTargetGroupSectionId,
      personaId,
      router,
      activeSectionId,
    ]
  );

  const handlePersonaChange = useCallback(
    (nextPersonaId: string) => {
      if (!nextPersonaId) {
        router.push(isTargetGroupV2Route ? ADMIN_ROUTES.targetGroupsV2 : ADMIN_ROUTES.personasV2);
        return;
      }
      router.push(ADMIN_ROUTES.personaV2Section(nextPersonaId, activeSectionId));
    },
    [router, activeSectionId, isTargetGroupV2Route]
  );

  return {
    personaId,
    targetGroupOptions: targetGroups,
    personaOptions: personas,
    activeTargetGroupId,
    activePersonaId: personaId ?? "",
    loadingTargetGroups,
    loadingPersonas,
    handleTargetGroupChange,
    handlePersonaChange,
  };
}
