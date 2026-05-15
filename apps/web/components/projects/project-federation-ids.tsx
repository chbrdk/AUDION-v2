"use client";

import { Box, Stack } from "@mui/material";
import Link from "next/link";
import { MsqdxTypography } from "@msqdx/react";

import { buildPlexonPlatformProjectDashboardUrl } from "../../lib/plexon-links";

export type ProjectFederationIdFields = {
  id: string;
  platform_project_id?: string | null;
  platform_company_id?: string | null;
  checkion_project_id?: string | null;
};

type ProjectFederationIdsProps = {
  project: ProjectFederationIdFields;
  labels: {
    audionProjectId: string;
    platformProjectId: string;
    platformCompanyId: string;
    checkionProjectId: string;
    openInPlexon: string;
  };
  /** MUI `sx` color for secondary captions */
  mutedColor?: string;
};

function IdRow({
  label,
  value,
  href,
  linkLabel,
  mutedColor,
}: {
  label: string;
  value: string;
  href?: string | null;
  linkLabel?: string;
  mutedColor?: string;
}) {
  return (
    <Box>
      <MsqdxTypography
        variant="caption"
        sx={{
          color: mutedColor ?? "text.secondary",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          display: "block",
          mb: 0.25,
        }}
      >
        {label}
      </MsqdxTypography>
      <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1}>
        <MsqdxTypography
          variant="caption"
          component="code"
          sx={{
            color: mutedColor ?? "text.secondary",
            fontFamily: "monospace",
            wordBreak: "break-all",
          }}
        >
          {value}
        </MsqdxTypography>
        {href && linkLabel ? (
          <Link href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.75rem" }}>
            {linkLabel}
          </Link>
        ) : null}
      </Stack>
    </Box>
  );
}

export function ProjectFederationIds({ project, labels, mutedColor }: ProjectFederationIdsProps) {
  const platformProjectId = (project.platform_project_id ?? "").trim();
  const platformCompanyId = (project.platform_company_id ?? "").trim();
  const checkionProjectId = (project.checkion_project_id ?? "").trim();
  const plexonHref = platformProjectId
    ? buildPlexonPlatformProjectDashboardUrl(platformProjectId)
    : null;

  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      <IdRow label={labels.audionProjectId} value={project.id} mutedColor={mutedColor} />
      {platformProjectId ? (
        <IdRow
          label={labels.platformProjectId}
          value={platformProjectId}
          href={plexonHref}
          linkLabel={plexonHref ? labels.openInPlexon : undefined}
          mutedColor={mutedColor}
        />
      ) : null}
      {platformCompanyId ? (
        <IdRow label={labels.platformCompanyId} value={platformCompanyId} mutedColor={mutedColor} />
      ) : null}
      {checkionProjectId ? (
        <IdRow label={labels.checkionProjectId} value={checkionProjectId} mutedColor={mutedColor} />
      ) : null}
    </Stack>
  );
}
