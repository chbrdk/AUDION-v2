"use client";

import { Box, Stack } from "@mui/material";
import { MsqdxTypography } from "@msqdx/react";

const SECTION_KEYS = [
    "company_overview",
    "offerings",
    "industries",
    "icp_hypotheses",
    "buying_roles",
    "objections",
    "proof_points",
    "terminology",
] as const;

type SectionKey = (typeof SECTION_KEYS)[number];

type ResearchClaim = { text?: string | null; citations?: string[]; confidence?: number | null };

type ResearchSectionShape = {
    summary?: string | null;
    claims?: ResearchClaim[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asSection(raw: unknown): ResearchSectionShape | null {
    if (!isRecord(raw)) return null;
    const claimsRaw = raw.claims;
    const claims = Array.isArray(claimsRaw)
        ? claimsRaw.filter((c): c is ResearchClaim => isRecord(c) && typeof (c as ResearchClaim).text === "string")
        : [];
    return {
        summary: typeof raw.summary === "string" ? raw.summary : raw.summary == null ? undefined : String(raw.summary),
        claims,
    };
}

function sectionTitle(key: SectionKey, t: (k: string) => string | undefined): string {
    const k = `settingsProjects.projectResearch.section_${key}`;
    return t(k) ?? key.replace(/_/g, " ");
}

/** Renders V1-shaped `summary_en` / `summary_de` objects for the project admin panel. */
export function ProjectResearchSummaryPreview({
    summary,
    t,
}: {
    summary: Record<string, unknown> | null | undefined;
    t: (key: string) => string | undefined;
}) {
    if (!summary || !isRecord(summary)) return null;

    const version = typeof summary.version === "string" ? summary.version : null;
    const hasAnySection = SECTION_KEYS.some((k) => asSection(summary[k]) !== null);

    return (
        <Stack spacing={2} sx={{ mt: 0.5 }}>
            {version ? (
                <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                    {t("settingsProjects.projectResearch.summarySchemaVersion") ?? "Schema"}: {version}
                </MsqdxTypography>
            ) : null}
            {!hasAnySection ? (
                <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                    {t("settingsProjects.projectResearch.summaryNoSections") ??
                        "Summary has no known V1 sections; use “Raw JSON” to inspect."}
                </MsqdxTypography>
            ) : null}
            {SECTION_KEYS.map((key) => {
                const sec = asSection(summary[key]);
                if (!sec || (!sec.summary?.trim() && !(sec.claims?.length ?? 0))) return null;
                return (
                    <Box key={key}>
                        <MsqdxTypography variant="subtitle2" weight="semibold" sx={{ mb: 0.75 }}>
                            {sectionTitle(key, t)}
                        </MsqdxTypography>
                        {sec.summary?.trim() ? (
                            <MsqdxTypography variant="body2" sx={{ color: "text.primary", mb: sec.claims?.length ? 1 : 0 }}>
                                {sec.summary.trim()}
                            </MsqdxTypography>
                        ) : null}
                        {sec.claims?.length ? (
                            <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2.25 }}>
                                {sec.claims.map((c, i) => (
                                    <Box component="li" key={i} sx={{ display: "list-item" }}>
                                        <MsqdxTypography variant="body2" sx={{ color: "text.primary" }}>
                                            {(c.text ?? "").trim() || "—"}
                                        </MsqdxTypography>
                                        {Array.isArray(c.citations) && c.citations.length > 0 ? (
                                            <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
                                                {c.citations.length}{" "}
                                                {c.citations.length === 1
                                                    ? (t("settingsProjects.projectResearch.citationSingular") ?? "source")
                                                    : (t("settingsProjects.projectResearch.citationPlural") ?? "sources")}
                                            </MsqdxTypography>
                                        ) : null}
                                    </Box>
                                ))}
                            </Stack>
                        ) : null}
                    </Box>
                );
            })}
        </Stack>
    );
}
