"use client";

import type { PersonaProfile } from "@msqdx-glass/types";
import { Box } from "@mui/material";
import { MsqdxDashboardCard } from "@msqdx/react";
import { MsqdxGlassDashboardCardSection } from "./msqdx-glass-dashboard-card-section";
import { MsqdxGlassChipEditor } from "../generic/msqdx-glass-chip-editor";
import { MsqdxGlassFieldEditor } from "../generic/msqdx-glass-field-editor";
import { useI18n } from "../i18n/i18n-provider";
import { THEME_ACCENT } from "../../lib/theme-accent";

export type MsqdxGlassCommunicationCardProps = {
  profile: PersonaProfile;
  expanded: boolean;
  onToggle: (id: string) => void;
  onSaveVocabulary?: (chips: string[]) => Promise<void>;
  onSaveSentenceStructure?: (value: string) => Promise<void>;
  onSaveSkepticismLevel?: (value: number) => Promise<void>;
  onAiSuggestVocabulary?: () => Promise<void>;
  aiVocabularyLoading?: boolean;
  highlightedVocabulary?: string[];
};

export const MsqdxGlassCommunicationCard = ({
  profile,
  expanded,
  onToggle,
  onSaveVocabulary,
  onSaveSentenceStructure,
  onSaveSkepticismLevel,
  onAiSuggestVocabulary,
  aiVocabularyLoading = false,
  highlightedVocabulary = []
}: MsqdxGlassCommunicationCardProps) => {
  const { t } = useI18n();
  if (!profile.communication_style) {
    return null;
  }

  return (
    <MsqdxDashboardCard
      id="communication"
      title={t("personaAdmin.communication")}
      icon="chat_bubble"
      iconColor={{ color: THEME_ACCENT.color }}
      expanded={expanded}
      onToggle={onToggle}
    >
      <MsqdxGlassChipEditor
        label={t("personaAdmin.vocabulary")}
        chips={profile.communication_style.vocabulary || []}
        chipClassName="--vocab"
        onSave={onSaveVocabulary || (async () => {})}
        editable={!!onSaveVocabulary}
        emptyMessage={t("personaAdmin.noVocabularyDefined")}
        onAiSuggest={onAiSuggestVocabulary}
        aiLoading={aiVocabularyLoading}
        highlightedChips={highlightedVocabulary}
      />
      <MsqdxGlassDashboardCardSection title={t("personaAdmin.sentenceStructure")}>
        <MsqdxGlassFieldEditor
          field={{
            key: "sentence_structure",
            label: t("personaAdmin.sentenceStructure"),
            type: "textarea",
            config: {
              placeholder: t("personaAdmin.sentenceStructurePlaceholder"),
              minLength: 10,
              maxLength: 600
            }
          }}
          value={profile.communication_style.sentence_structure || ""}
          valueSyncKey={profile.id}
          onChange={() => {}}
          onSave={
            onSaveSentenceStructure
              ? async (_key, value) =>
                  onSaveSentenceStructure(typeof value === "string" ? value : "")
              : undefined
          }
          inline
        />
      </MsqdxGlassDashboardCardSection>
      <MsqdxGlassDashboardCardSection title={t("personaAdmin.skepticism")}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
            <span>{t("personaAdmin.skepticismLow")}</span>
            <span>{t("personaAdmin.skepticismHigh")}</span>
          </div>
          <div style={{ width: "100%", height: "10px", backgroundColor: "var(--color-neutral)", borderRadius: "5px", overflow: "hidden" }}>
            <div 
              style={{ 
                width: `${((profile.communication_style.skepticism_level || 0) / 5) * 100}%`, 
                height: "100%", 
                backgroundColor: "var(--color-secondary-dx-orange)",
                transition: "width 0.3s ease"
              }}
            />
          </div>
          <div style={{ fontSize: "0.875rem", color: "var(--color-muted)" }}>
            Level: {profile.communication_style.skepticism_level || 0} / 5
          </div>
          {onSaveSkepticismLevel && (
            <Box sx={{ mt: 1 }}>
              <MsqdxGlassFieldEditor
                field={{
                  key: "skepticism_level",
                  label: t("personaAdmin.skepticismLevel"),
                  type: "slider",
                  config: { min: 0, max: 5, step: 1 }
                }}
                value={profile.communication_style.skepticism_level || 0}
                valueSyncKey={profile.id}
                onChange={() => {}}
                onSave={async (_key, value) =>
                  onSaveSkepticismLevel(
                    typeof value === "number" ? value : Number(value) || 0
                  )
                }
                inline
              />
            </Box>
          )}
        </div>
      </MsqdxGlassDashboardCardSection>
    </MsqdxDashboardCard>
  );
};

