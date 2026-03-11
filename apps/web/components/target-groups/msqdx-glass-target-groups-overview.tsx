"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Stack } from "@mui/material";
import type { TargetGroupListResponse, TargetGroupResponse } from "@msqdx-glass/types";
import { MsqdxButton, MsqdxFormField, MsqdxIcon, MsqdxMoleculeCard, MsqdxTextareaField, MsqdxTypography } from "@msqdx/react";
import { buildApiUrl } from "../../app/api/_lib/backend";
import { ADMIN_ROUTES } from "../../lib/routes";
import { useProject } from "../projects/project-provider";
import { useI18n } from "../i18n/i18n-provider";

export type MsqdxGlassTargetGroupsOverviewProps = {
  initialList: TargetGroupListResponse;
};

type CreateFormState = {
  name: string;
  segment: string;
  description: string;
};

const defaultCreateFormState: CreateFormState = {
  name: "",
  segment: "",
  description: "",
};

function extractTargetGroupId(payload: unknown): string | null {
  const anyPayload = payload as any;
  return anyPayload?.id ?? anyPayload?.targetGroupId ?? anyPayload?.target_group_id ?? null;
}

export function MsqdxGlassTargetGroupsOverview({ initialList }: MsqdxGlassTargetGroupsOverviewProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { activeProjectId, activeProject } = useProject();
  const accent = "var(--color-theme-accent)";

  const [list, setList] = useState<TargetGroupListResponse>(initialList);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(defaultCreateFormState);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const items = useMemo(() => list.items ?? [], [list.items]);

  const refresh = async (projectId: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(
        buildApiUrl(`/api/target-groups?page=1&page_size=50&project_id=${encodeURIComponent(projectId)}`),
        { cache: "no-store" }
      );
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail ? `${response.status}: ${detail}` : `Backend responded with ${response.status}`);
      }
      const payload = (await response.json()) as TargetGroupListResponse;
      setList(payload);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load target groups");
      setList({ items: [], total: 0, page: 1, page_size: 50 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeProjectId) {
      setList({ items: [], total: 0, page: 1, page_size: 50 });
      return;
    }
    void refresh(activeProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const handleCreate = async () => {
    const name = createForm.name.trim();
    const segment = createForm.segment.trim();
    if (!activeProjectId || !name || !segment) {
      setCreateError(t("targetGroupsAdmin.toasts.projectNameSegmentRequired"));
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const payload = {
        project_id: activeProjectId,
        name,
        segment,
        description: createForm.description.trim() || null,
      };

      const response = await fetch(buildApiUrl("/api/target-groups"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail ? `${response.status}: ${detail}` : `Backend responded with ${response.status}`);
      }

      const created = (await response.json()) as TargetGroupResponse;
      const newId = extractTargetGroupId(created);
      setCreateForm(defaultCreateFormState);
      setShowCreate(false);
      await refresh(activeProjectId);
      if (newId) {
        router.push(ADMIN_ROUTES.targetGroupDetail(newId));
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : t("targetGroupsAdmin.toasts.createError"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Box sx={{ width: "100%" }} className="msqdx-glass-target-groups-overview">
      <Box
        className="msqdx-glass-target-groups-grid"
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(3, minmax(0, 1fr))",
          },
          gap: 2,
          alignItems: "start",
        }}
      >
        {/* Create Target Group */}
        {!showCreate ? (
          <MsqdxMoleculeCard
            variant="flat"
            borderRadius="button"
            clickable
            hoverable
            onClick={() => setShowCreate(true)}
            title={t("targetGroupsAdmin.newTargetGroup")}
            titleVariant="h6"
            subtitle={t("targetGroupsAdmin.namePlaceholder")}
            headerActions={<MsqdxIcon name="add" customSize={22} style={{ color: accent }} />}
            sx={{
              minHeight: 140,
              border: "2px dashed",
              borderColor: accent,
              "& .MuiTypography-h6": { color: accent },
            }}
          />
        ) : (
          <MsqdxMoleculeCard
            variant="flat"
            borderRadius="button"
            title={t("targetGroupsAdmin.newTargetGroup")}
            titleVariant="h6"
            sx={{
              minHeight: 140,
              border: "1px solid",
              borderColor: accent,
              "& .MuiTypography-h6": { color: accent },
            }}
            actions={(
              <>
                <MsqdxButton
                  variant="outlined"
                  size="small"
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setCreateForm(defaultCreateFormState);
                    setCreateError(null);
                  }}
                  disabled={creating}
                  sx={{
                    borderColor: accent,
                    color: accent,
                    "&:hover": { borderColor: accent, backgroundColor: "transparent" },
                  }}
                >
                  {t("common.cancel")}
                </MsqdxButton>
                <MsqdxButton
                  variant="contained"
                  size="small"
                  type="button"
                  onClick={handleCreate}
                  disabled={creating || !activeProjectId}
                  sx={{
                    backgroundColor: `${accent} !important`,
                    color: "white !important",
                    "&:hover": { backgroundColor: `${accent} !important`, filter: "brightness(1.05)" },
                  }}
                >
                  {t("targetGroupsAdmin.create")}
                </MsqdxButton>
              </>
            )}
          >
            <Stack spacing={1.5}>
              <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                {activeProject?.name
                  ? t("targetGroupsAdmin.projectLabel", { name: activeProject.name })
                  : activeProjectId
                    ? t("targetGroupsAdmin.projectIdLabel", { id: activeProjectId })
                    : t("targetGroupsAdmin.selectProject")}
              </MsqdxTypography>
              <MsqdxFormField
                label={t("targetGroupsAdmin.name")}
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t("targetGroupsAdmin.namePlaceholder")}
                size="small"
                autoFocus
                fullWidth
              />
              <MsqdxFormField
                label={t("targetGroupsAdmin.segment")}
                value={createForm.segment}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, segment: e.target.value }))}
                placeholder={t("targetGroupsAdmin.segmentPlaceholder")}
                size="small"
                fullWidth
              />
              <MsqdxTextareaField
                label={t("targetGroupsAdmin.description")}
                value={createForm.description}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={t("targetGroupsAdmin.descriptionPlaceholder")}
                minRows={3}
                fullWidth
              />
              {createError && (
                <MsqdxTypography variant="caption" sx={{ color: "error.main" }}>
                  {createError}
                </MsqdxTypography>
              )}
            </Stack>
          </MsqdxMoleculeCard>
        )}

        {/* Target group cards */}
        {items.map((tg) => (
          <MsqdxMoleculeCard
            key={tg.id}
            variant="flat"
            borderRadius="button"
            clickable
            hoverable
            onClick={() => router.push(ADMIN_ROUTES.targetGroupDetail(tg.id))}
            title={tg.name}
            titleVariant="h6"
            subtitle={tg.segment}
            headerActions={<MsqdxIcon name="chevron_right" customSize={20} style={{ color: accent }} />}
            actions={(
              <MsqdxButton
                variant="outlined"
                size="small"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push(ADMIN_ROUTES.targetGroupDetail(tg.id));
                }}
                sx={{
                  borderColor: accent,
                  color: accent,
                  "&:hover": { borderColor: accent, backgroundColor: "transparent" },
                }}
              >
                {t("common.view")}
              </MsqdxButton>
            )}
            sx={{
              minHeight: 140,
              border: "1px solid",
              borderColor: accent,
              "&:hover": { borderColor: accent },
              "& .MuiTypography-h6": { color: accent },
            }}
          />
        ))}
      </Box>

      {(loading || loadError || (!activeProjectId && !items.length)) && (
        <Box sx={{ mt: 2 }}>
          {loading && (
            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
              {t("targetGroupsAdmin.loading")}
            </MsqdxTypography>
          )}
          {loadError && (
            <MsqdxTypography variant="body2" sx={{ color: "error.main" }}>
              {loadError}
            </MsqdxTypography>
          )}
          {!activeProjectId && (
            <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
              {t("targetGroupsAdmin.selectProject")}
            </MsqdxTypography>
          )}
        </Box>
      )}
    </Box>
  );
}

