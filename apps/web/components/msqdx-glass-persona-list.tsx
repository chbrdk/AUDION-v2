"use client";

import Link from "next/link";
import { Box, Tooltip } from "@mui/material";
import { MsqdxTypography, MsqdxButton, MsqdxIcon, MsqdxCard, MsqdxChip } from "@msqdx/react";
import type { PersonaListItem } from "@msqdx-glass/types";
import { useI18n } from "./i18n/i18n-provider";

type MsqdxGlassPersonaListProps = {
  personas: PersonaListItem[];
  onSelect?: (personaId: string) => void;
  onDelete?: (personaId: string) => void;
  actionLabel?: string;
  /** Override open-persona link (e.g. personas v2 basics route). */
  getPersonaDetailHref?: (personaId: string) => string;
  showConfidence?: boolean;
};

export const MsqdxGlassPersonaList = ({
  personas,
  onSelect,
  onDelete,
  actionLabel = "Chat",
  getPersonaDetailHref,
  showConfidence = true,
}: MsqdxGlassPersonaListProps) => {
  const { t } = useI18n();

  if (personas.length === 0) {
    return (
      <Box sx={{ py: 2 }}>
        <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
          {t("personaAdmin.emptyInTargetGroup")}
        </MsqdxTypography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {personas.map((persona) => {
        return (
          <MsqdxCard key={persona.id} variant="flat" sx={{ p: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
                <MsqdxTypography variant="subtitle1" weight="semibold">
                  {persona.name}
                </MsqdxTypography>
                {showConfidence ? (
                  <Tooltip title={t("personaAdmin.confidenceHint")}>
                    <Box component="span">
                      <MsqdxChip
                        variant="outlined"
                        size="small"
                        label={t("personaAdmin.confidencePercent", {
                          value: Math.round(Math.min(1, Math.max(0, persona.confidence)) * 100),
                        })}
                        sx={{
                          height: 22,
                          borderColor: "divider",
                          "& .MuiChip-label": { fontSize: "0.7rem" },
                        }}
                      />
                    </Box>
                  </Tooltip>
                ) : null}
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                <Link
                  href={getPersonaDetailHref?.(persona.id) ?? `/personas/admin?selected=${persona.id}`}
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
                    aria-label={t("personaAdmin.openPersona")}
                  />
                </Link>
                {onDelete && (
                  <MsqdxButton
                    variant="text"
                    size="small"
                    brandColor="pink"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(t("personaAdmin.deleteConfirm", { name: persona.name }))) {
                        onDelete(persona.id);
                      }
                    }}
                    startIcon={<MsqdxIcon name="delete" customSize={18} />}
                    aria-label={t("personaAdmin.deletePersona")}
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

