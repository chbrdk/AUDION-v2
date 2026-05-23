"use client";

import { useEffect, useMemo, useState } from "react";
import { MsqdxGlassAdminHeaderBackIconButton } from "../admin/msqdx-glass-admin-header-back-icon-button";
import { buildApiUrl } from "../../app/api/_lib/backend";
import { ADMIN_ROUTES } from "../../lib/routes";
import { PERSONA_V2_SECTIONS, personaV2SectionHref, type PersonaV2SectionId } from "../../lib/persona-v2-sections";
import { useI18n } from "../i18n/i18n-provider";
import { MsqdxGlassSectionShell } from "../admin/section-shell";
import type { SectionNavItem } from "../admin/section-shell";
import { MsqdxGlassPersonaV2SectionContent } from "./msqdx-glass-persona-v2-section-content";
import { useAdminHeader } from "../admin/admin-layout-providers";

export type MsqdxGlassPersonaV2DetailLayoutProps = {
  personaId: string;
  sectionId: PersonaV2SectionId;
  docsUrl: string;
  children?: never;
};

type PersonaSummary = {
  name: string;
  segment: string;
};

export function MsqdxGlassPersonaV2DetailLayout({ personaId, sectionId, docsUrl }: MsqdxGlassPersonaV2DetailLayoutProps) {
  const { t } = useI18n();
  const { setHeaderStartContent } = useAdminHeader();
  const [summary, setSummary] = useState<PersonaSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setHeaderStartContent(
      <MsqdxGlassAdminHeaderBackIconButton
        href={ADMIN_ROUTES.personasV2}
        ariaLabel={t("personaV2.backToList")}
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
        const res = await fetch(buildApiUrl(`/api/persona-admin/${encodeURIComponent(personaId)}`), {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`Failed to load persona (${res.status})`);
        }
        const data = (await res.json()) as {
          profile?: { name?: string; headline?: string; segment?: string };
        };
        if (cancelled) return;
        setSummary({
          name: data.profile?.name?.trim() || personaId,
          segment: data.profile?.segment?.trim() || "",
        });
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : t("personaAdmin.loadFailed"));
          setSummary({ name: personaId, segment: "" });
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [personaId, t]);

  const navItems: SectionNavItem[] = useMemo(
    () =>
      PERSONA_V2_SECTIONS.map((s) => ({
        id: s.id,
        href: personaV2SectionHref(personaId, s.id),
        label: t(s.labelKey),
        description: t(s.descriptionKey),
        icon: s.icon,
      })),
    [personaId, t]
  );

  return (
    <MsqdxGlassSectionShell
      className="msqdx-glass-persona-v2-detail"
      entityTitle={summary?.name ?? t("personaAdmin.loading")}
      entitySubtitle={summary?.segment?.trim() ? summary.segment.trim() : undefined}
      activeSectionId={sectionId}
      navItems={navItems}
      navLabel={t("personaV2.sectionsNavLabel")}
      wideContent
      entityCornerAccent
    >
      {loadError ? <p style={{ color: "var(--color-secondary-dx-pink-on-light)" }}>{loadError}</p> : null}
      <MsqdxGlassPersonaV2SectionContent
        personaId={personaId}
        sectionId={sectionId}
        personaName={summary?.name}
        docsUrl={docsUrl}
      />
    </MsqdxGlassSectionShell>
  );
}
