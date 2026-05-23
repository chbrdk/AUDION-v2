"use client";

import type { PersonaProfile } from "@msqdx-glass/types";
import { Box, Stack } from "@mui/material";
import { MsqdxDashboardCard } from "@msqdx/react";
import { MsqdxGlassDashboardCardSection } from "./msqdx-glass-dashboard-card-section";
import { MsqdxGlassChipEditor } from "../generic/msqdx-glass-chip-editor";
import { MsqdxGlassFieldEditor } from "../generic/msqdx-glass-field-editor";
import { MsqdxGlassPainGoalsSectorSeparator } from "../generic/msqdx-glass-pain-goals-sector-separator";
import { PersonaV2SectionBlock } from "../personas-v2/persona-v2-section-block";
import { useI18n } from "../i18n/i18n-provider";
import { THEME_ACCENT } from "../../lib/theme-accent";
import { COMMUNICATION_VOCABULARY_CHIP_PROPS } from "../../lib/persona-communication-chip-layout";

const COMMUNICATION_CARD_ID = "communication";

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
  /** Section shell + sub-nav label the section — flat stack (persona v2). */
  embedInSection?: boolean;
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
  highlightedVocabulary = [],
  embedInSection = false,
}: MsqdxGlassCommunicationCardProps) => {
  const { t } = useI18n();
  if (!profile.communication_style) {
    return null;
  }

  const vocabularyBlock = (
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
      {...COMMUNICATION_VOCABULARY_CHIP_PROPS}
    />
  );

  const sentenceField = (
    <MsqdxGlassFieldEditor
      field={{
        key: "sentence_structure",
        label: t("personaAdmin.sentenceStructure"),
        type: "textarea",
        config: {
          placeholder: t("personaAdmin.sentenceStructurePlaceholder"),
          minLength: 10,
          maxLength: 600,
        },
      }}
      value={profile.communication_style.sentence_structure || ""}
      valueSyncKey={profile.id}
      onChange={() => {}}
      onSave={
        onSaveSentenceStructure
          ? async (_key, value) => onSaveSentenceStructure(typeof value === "string" ? value : "")
          : undefined
      }
      inline
    />
  );

  const skepticismBody = (
    <div className="msqdx-glass-communication-skepticism">
      <div className="msqdx-glass-communication-skepticism__labels">
        <span>{t("personaAdmin.skepticismLow")}</span>
        <span>{t("personaAdmin.skepticismHigh")}</span>
      </div>
      <div className="msqdx-glass-communication-skepticism__track" aria-hidden>
        <div
          className="msqdx-glass-communication-skepticism__fill"
          style={{
            width: `${((profile.communication_style.skepticism_level || 0) / 5) * 100}%`,
          }}
        />
      </div>
      <p className="msqdx-glass-communication-skepticism__level">
        {t("personaAdmin.skepticismLevel")}: {profile.communication_style.skepticism_level || 0} / 5
      </p>
      {onSaveSkepticismLevel ? (
        <Box sx={{ mt: 1 }}>
          <MsqdxGlassFieldEditor
            field={{
              key: "skepticism_level",
              label: t("personaAdmin.skepticismLevel"),
              type: "slider",
              config: { min: 0, max: 5, step: 1 },
            }}
            value={profile.communication_style.skepticism_level || 0}
            valueSyncKey={profile.id}
            onChange={() => {}}
            onSave={async (_key, value) =>
              onSaveSkepticismLevel(typeof value === "number" ? value : Number(value) || 0)
            }
            inline
          />
        </Box>
      ) : null}
    </div>
  );

  const stackBody = (
    <Stack component="section" className="msqdx-glass-communication-stack" spacing={0}>
      <Box component="article" className="msqdx-glass-communication-stack__block --vocab">
        {vocabularyBlock}
      </Box>
      <MsqdxGlassPainGoalsSectorSeparator />
      <PersonaV2SectionBlock
        title={t("personaAdmin.sentenceStructure")}
        className="msqdx-glass-communication-stack__block --sentence"
      >
        {sentenceField}
      </PersonaV2SectionBlock>
      <MsqdxGlassPainGoalsSectorSeparator />
      <PersonaV2SectionBlock
        title={t("personaAdmin.skepticism")}
        className="msqdx-glass-communication-stack__block --skepticism"
      >
        {skepticismBody}
      </PersonaV2SectionBlock>
    </Stack>
  );

  if (embedInSection) {
    return (
      <Box sx={{ gridColumn: "1 / -1", width: "100%" }} className="msqdx-glass-communication-section">
        {stackBody}
      </Box>
    );
  }

  return (
    <MsqdxDashboardCard
      id={COMMUNICATION_CARD_ID}
      title={t("personaAdmin.communication")}
      icon="chat_bubble"
      iconColor={{ color: THEME_ACCENT.color }}
      expanded={expanded}
      onToggle={onToggle}
      className="--communication"
    >
      {vocabularyBlock}
      <MsqdxGlassDashboardCardSection title={t("personaAdmin.sentenceStructure")}>
        {sentenceField}
      </MsqdxGlassDashboardCardSection>
      <MsqdxGlassDashboardCardSection title={t("personaAdmin.skepticism")}>
        {skepticismBody}
      </MsqdxGlassDashboardCardSection>
    </MsqdxDashboardCard>
  );
};
