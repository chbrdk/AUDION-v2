"use client";

import type { ReactNode } from "react";
import type { TargetGroupResponse } from "@msqdx-glass/types";
import { getFieldDefinitions } from "@msqdx-glass/types";
import { Box } from "@mui/material";
import { useI18n } from "../i18n/i18n-provider";
import { MsqdxGlassFieldEditor } from "../generic";
import { PersonaV2SectionBlock } from "../personas-v2/persona-v2-section-block";

export type MsqdxGlassTargetGroupBasicsLocalizationProps = {
  detail: TargetGroupResponse;
  selectedId: string | null;
  savePending: boolean;
  onSave: (updates: Record<string, unknown>) => Promise<void>;
};

function V2FieldStack({
  label,
  fieldKey,
  className,
  children,
}: {
  label: string;
  fieldKey: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={["msqdx-glass-v2-field-stack", className].filter(Boolean).join(" ")}
      data-field={fieldKey}
    >
      <span className="msqdx-glass-v2-field-stack__label">{label}</span>
      {children}
    </div>
  );
}

export function MsqdxGlassTargetGroupBasicsLocalization({
  detail,
  selectedId,
  savePending,
  onSave,
}: MsqdxGlassTargetGroupBasicsLocalizationProps) {
  const { t } = useI18n();
  const fields = getFieldDefinitions("targetGroup");
  const nameDeField = fields.find((f) => f.key === "name_de");
  const segmentDeField = fields.find((f) => f.key === "segment_de");
  const descriptionDeField = fields.find((f) => f.key === "description_de");

  const handleFieldSave = async (key: string, value: unknown) => {
    await onSave({ [key]: value });
  };

  const resolveLabel = (field: (typeof fields)[number]) => {
    if (field.labelKey) {
      const translated = t(field.labelKey);
      if (translated !== field.labelKey) return translated;
    }
    return field.label;
  };

  return (
    <PersonaV2SectionBlock title={t("targetGroupV2.basics.localizationTitle")}>
      <div className="msqdx-glass-target-group-basics-localization">
        <div className="msqdx-glass-target-group-basics-localization__grid">
          {nameDeField ? (
            <V2FieldStack label={resolveLabel(nameDeField)} fieldKey="name_de">
              <Box sx={{ minWidth: 0 }}>
                <MsqdxGlassFieldEditor
                  field={nameDeField}
                  value={detail.name_de ?? ""}
                  valueSyncKey={selectedId || undefined}
                  onChange={() => {}}
                  onSave={(k, v) => handleFieldSave(k, v)}
                  inline
                  disabled={savePending}
                />
              </Box>
            </V2FieldStack>
          ) : null}

          {segmentDeField ? (
            <V2FieldStack label={resolveLabel(segmentDeField)} fieldKey="segment_de">
              <Box sx={{ minWidth: 0 }}>
                <MsqdxGlassFieldEditor
                  field={segmentDeField}
                  value={detail.segment_de ?? ""}
                  valueSyncKey={selectedId || undefined}
                  onChange={() => {}}
                  onSave={(k, v) => handleFieldSave(k, v)}
                  inline
                  disabled={savePending}
                />
              </Box>
            </V2FieldStack>
          ) : null}

          {descriptionDeField ? (
            <V2FieldStack
              label={resolveLabel(descriptionDeField)}
              fieldKey="description_de"
              className="msqdx-glass-target-group-basics-localization__description"
            >
              <Box sx={{ minWidth: 0 }}>
                <MsqdxGlassFieldEditor
                  field={descriptionDeField}
                  value={detail.description_de ?? ""}
                  valueSyncKey={selectedId || undefined}
                  onChange={() => {}}
                  onSave={(k, v) => handleFieldSave(k, v)}
                  inline
                  disabled={savePending}
                />
              </Box>
            </V2FieldStack>
          ) : null}
        </div>
      </div>
    </PersonaV2SectionBlock>
  );
}
