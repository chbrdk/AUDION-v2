"use client";

import Link from "next/link";
import { Box } from "@mui/material";
import { MsqdxTypography, MsqdxChip, MsqdxButton, MsqdxIcon, MsqdxCard } from "@msqdx/react";
import type { PersonaListItem } from "@msqdx-glass/types";

const statusChipConfig: Record<string, { label: string; brandColor: "orange" | "green" | "purple" }> = {
  draft: { label: "Draft", brandColor: "orange" },
  published: { label: "Published", brandColor: "green" },
  archived: { label: "Archived", brandColor: "purple" },
};

type MsqdxGlassPersonaListProps = {
  personas: PersonaListItem[];
  onSelect?: (personaId: string) => void;
  onDelete?: (personaId: string) => void;
  actionLabel?: string;
};

export const MsqdxGlassPersonaList = ({
  personas,
  onSelect,
  onDelete,
  actionLabel = "Chat",
}: MsqdxGlassPersonaListProps) => {
  if (personas.length === 0) {
    return (
      <Box sx={{ py: 2 }}>
        <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
          No personas in this Target Group.
        </MsqdxTypography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {personas.map((persona) => {
        const config = statusChipConfig[persona.status] ?? statusChipConfig.draft;
        return (
          <MsqdxCard key={persona.id} variant="flat" sx={{ p: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 0 }}>
                <MsqdxTypography variant="subtitle1" weight="semibold">
                  {persona.name}
                </MsqdxTypography>
                <MsqdxChip variant="filled" brandColor={config.brandColor} label={config.label} size="small" />
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                <Link
                  href={`/personas/admin?selected=${persona.id}`}
                  onClick={(e) => {
                    if (onSelect) {
                      e.preventDefault();
                      onSelect(persona.id);
                    }
                  }}
                  style={{ textDecoration: "none" }}
                >
                  <MsqdxButton
                    variant="text"
                    size="small"
                    component="span"
                    startIcon={<MsqdxIcon name="open_in_new" customSize={18} />}
                    aria-label="Open persona"
                  />
                </Link>
                {onDelete && (
                  <MsqdxButton
                    variant="text"
                    size="small"
                    brandColor="pink"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Are you sure you want to delete the persona "${persona.name}"?`)) {
                        onDelete(persona.id);
                      }
                    }}
                    startIcon={<MsqdxIcon name="delete" customSize={18} />}
                    aria-label="Delete persona"
                  />
                )}
              </Box>
            </Box>
          </MsqdxCard>
        );
      })}
    </Box>
  );
};

MsqdxGlassPersonaList.displayName = "msqdx-glass-persona-list";

