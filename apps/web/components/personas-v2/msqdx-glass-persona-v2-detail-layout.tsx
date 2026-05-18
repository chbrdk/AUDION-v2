"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MsqdxButton } from "@msqdx/react";
import { buildApiUrl } from "../../app/api/_lib/backend";
import { ADMIN_ROUTES } from "../../lib/routes";
import {
  PERSONA_V2_SECTIONS,
  personaV2SectionHref,
  type PersonaV2SectionId,
} from "../../lib/persona-v2-sections";
import { useI18n } from "../i18n/i18n-provider";
import { MsqdxGlassSectionShell } from "../admin/section-shell";
import type { SectionNavItem } from "../admin/section-shell";
import { MsqdxGlassPersonaV2SectionContent } from "./msqdx-glass-persona-v2-section-content";

export type MsqdxGlassPersonaV2DetailLayoutProps = {
  personaId: string;
  sectionId: PersonaV2SectionId;
  docsUrl: string;
  children?: never;
};

type PersonaSummary = {
  name: string;
  headline: string;
  segment: string;
};

export function MsqdxGlassPersonaV2DetailLayout({ personaId, sectionId, docsUrl }: MsqdxGlassPersonaV2DetailLayoutProps) {
  const { t } = useI18n();
  const [summary, setSummary] = useState<PersonaSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
          headline: data.profile?.headline?.trim() || "",
          segment: data.profile?.segment?.trim() || "",
        });
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : t("personaAdmin.loadFailed"));
          setSummary({ name: personaId, headline: "", segment: "" });
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

  const activeSection = PERSONA_V2_SECTIONS.find((s) => s.id === sectionId) ?? PERSONA_V2_SECTIONS[0]!;

  return (
    <MsqdxGlassSectionShell
      scopeLabel={t("personaV2.scopeLabel")}
      entityTitle={summary?.name ?? t("personaAdmin.loading")}
      entitySubtitle={
        summary?.headline || summary?.segment
          ? [summary.headline, summary.segment].filter(Boolean).join(" · ")
          : undefined
      }
      backHref={ADMIN_ROUTES.personasV2}
      backLabel={t("personaV2.backToList")}
      activeSectionId={sectionId}
      navItems={navItems}
      navLabel={t("personaV2.sectionsNavLabel")}
      sectionTitle={t(activeSection.labelKey)}
      sectionDescription={t(activeSection.descriptionKey)}
      wideContent
      headerActions={
        <Link href={ADMIN_ROUTES.personaDetail(personaId)} style={{ textDecoration: "none" }}>
          <MsqdxButton variant="outlined" size="small">
            {t("personaV2.openClassic")}
          </MsqdxButton>
        </Link>
      }
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
