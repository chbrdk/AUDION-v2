"use client";

import { useEffect, useMemo, useState } from "react";
import { MsqdxGlassAdminHeaderBackIconButton } from "../admin/msqdx-glass-admin-header-back-icon-button";
import { fetchTargetGroup } from "../../app/api/_lib/target-group";
import { ADMIN_ROUTES } from "../../lib/routes";
import {
  getTargetGroupV2SectionDef,
  TARGET_GROUP_V2_SECTIONS,
  targetGroupV2SectionHref,
  type TargetGroupV2SectionId,
} from "../../lib/target-group-v2-sections";
import { useI18n } from "../i18n/i18n-provider";
import { MsqdxGlassSectionShell } from "../admin/section-shell";
import type { SectionNavItem } from "../admin/section-shell";
import { MsqdxGlassTargetGroupV2SectionContent } from "./msqdx-glass-target-group-v2-section-content";
import { useAdminHeader } from "../admin/admin-layout-providers";

export type MsqdxGlassTargetGroupV2DetailLayoutProps = {
  targetGroupId: string;
  sectionId: TargetGroupV2SectionId;
  docsUrl: string;
};

type TargetGroupSummary = {
  name: string;
  segment: string;
};

export function MsqdxGlassTargetGroupV2DetailLayout({
  targetGroupId,
  sectionId,
  docsUrl,
}: MsqdxGlassTargetGroupV2DetailLayoutProps) {
  const { t } = useI18n();
  const { setHeaderStartContent } = useAdminHeader();
  const [summary, setSummary] = useState<TargetGroupSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setHeaderStartContent(
      <MsqdxGlassAdminHeaderBackIconButton
        href={ADMIN_ROUTES.targetGroupsV2}
        ariaLabel={t("targetGroupV2.backToList")}
      />
    );
    return () => {
      setHeaderStartContent(null);
    };
  }, [setHeaderStartContent, t]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadError(null);
      try {
        const data = await fetchTargetGroup(targetGroupId);
        if (cancelled) return;
        setSummary({
          name: data.name?.trim() || targetGroupId,
          segment: data.segment?.trim() || "",
        });
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : t("targetGroupsAdmin.loadFailed"));
          setSummary({ name: targetGroupId, segment: "" });
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [targetGroupId, t]);

  const navItems: SectionNavItem[] = useMemo(
    () =>
      TARGET_GROUP_V2_SECTIONS.map((s) => ({
        id: s.id,
        href: targetGroupV2SectionHref(targetGroupId, s.id),
        label: t(s.labelKey),
        description: t(s.descriptionKey),
        icon: s.icon,
      })),
    [targetGroupId, t]
  );

  const activeSection = getTargetGroupV2SectionDef(sectionId);

  return (
    <MsqdxGlassSectionShell
      className="msqdx-glass-target-group-v2-detail"
      entityTitle={summary?.name ?? t("targetGroupsAdmin.loading")}
      entitySubtitle={summary?.segment?.trim() ? summary.segment.trim() : undefined}
      activeSectionId={sectionId}
      navItems={navItems}
      navLabel={t("targetGroupV2.sectionsNavLabel")}
      sectionTitle={t(activeSection.labelKey)}
      sectionDescription={t(activeSection.descriptionKey)}
      wideContent
      entityCornerAccent
    >
      {loadError ? <p style={{ color: "var(--color-secondary-dx-pink-on-light)" }}>{loadError}</p> : null}
      <MsqdxGlassTargetGroupV2SectionContent
        targetGroupId={targetGroupId}
        sectionId={sectionId}
        docsUrl={docsUrl}
      />
    </MsqdxGlassSectionShell>
  );
}
