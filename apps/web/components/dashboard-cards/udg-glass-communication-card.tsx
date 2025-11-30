"use client";

import type { PersonaProfile } from "@udg-glass/types";
import { Box } from "@mui/material";
import { UdgGlassDashboardCard } from "./udg-glass-dashboard-card";
import { UdgGlassDashboardCardSection } from "./udg-glass-dashboard-card-section";
import { UdgGlassChipEditor } from "../generic/udg-glass-chip-editor";
import { UdgGlassFieldEditor } from "../generic/udg-glass-field-editor";

export type UdgGlassCommunicationCardProps = {
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

export const UdgGlassCommunicationCard = ({
  profile,
  expanded,
  onToggle,
  onSaveVocabulary,
  onSaveSentenceStructure,
  onSaveSkepticismLevel,
  onAiSuggestVocabulary,
  aiVocabularyLoading = false,
  highlightedVocabulary = []
}: UdgGlassCommunicationCardProps) => {
  if (!profile.communication_style) {
    return null;
  }

  return (
    <UdgGlassDashboardCard
      id="communication"
      title="Communication"
      icon="chat_bubble"
      variant="communication"
      iconColor={{
        color: "var(--color-theme-accent)"
      }}
      borderColor="var(--color-theme-accent)"
      expanded={expanded}
      onToggle={onToggle}
    >
      <UdgGlassChipEditor
        label="Vocabulary"
        chips={profile.communication_style.vocabulary || []}
        chipClassName="--vocab"
        onSave={onSaveVocabulary || (async () => {})}
        editable={!!onSaveVocabulary}
        emptyMessage="No vocabulary defined"
        onAiSuggest={onAiSuggestVocabulary}
        aiLoading={aiVocabularyLoading}
        highlightedChips={highlightedVocabulary}
      />
      <UdgGlassDashboardCardSection title="Sentence Structure">
        <UdgGlassFieldEditor
          field={{
            key: "sentence_structure",
            label: "Sentence Structure",
            type: "textarea",
            config: {
              placeholder: "e.g., clear, purposeful, uses first-person perspective",
              minLength: 10,
              maxLength: 600
            }
          }}
          value={profile.communication_style.sentence_structure || ""}
          onChange={() => {}}
          onSave={
            onSaveSentenceStructure
              ? async (_key, value) =>
                  onSaveSentenceStructure(typeof value === "string" ? value : "")
              : undefined
          }
          inline
        />
      </UdgGlassDashboardCardSection>
      <UdgGlassDashboardCardSection title="Skepticism">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
            <span>Low</span>
            <span>High</span>
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
              <UdgGlassFieldEditor
                field={{
                  key: "skepticism_level",
                  label: "Skepticism level",
                  type: "slider",
                  config: { min: 0, max: 5, step: 1 }
                }}
                value={profile.communication_style.skepticism_level || 0}
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
      </UdgGlassDashboardCardSection>
    </UdgGlassDashboardCard>
  );
};

