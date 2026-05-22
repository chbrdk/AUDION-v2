"use client";

import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import type { PersonaProfile } from "@msqdx-glass/types";
import { Box, Slider, Typography, Stack, TextField } from "@mui/material";
import { MsqdxDashboardCard, MsqdxSelect, MsqdxFormField } from "@msqdx/react";
import { MsqdxGlassDashboardCardSection } from "./msqdx-glass-dashboard-card-section";
import { useI18n } from "../i18n/i18n-provider";
import { FORM_FIELD_ACCENT_SX, THEME_ACCENT } from "../../lib/theme-accent";
import { MsqdxGlassInlineEditControls } from "../msqdx-glass-inline-edit-controls";
import { useInlineEdit } from "../hooks/use-inline-edit";
import { PersonaV2SectionBlock } from "../personas-v2/persona-v2-section-block";
import { MsqdxGlassPainGoalsSectorSeparator } from "../generic/msqdx-glass-pain-goals-sector-separator";

export type MsqdxGlassBioCardEditProps = {
  profile: PersonaProfile;
  expanded: boolean;
  onToggle: (id: string) => void;
  onSave: (updates: Partial<PersonaProfile>) => Promise<void>;
  savePending?: boolean;
  /** Section shell shows title — flat stack with mono block headings (persona v2). */
  embedInSection?: boolean;
  /** Render biography + demographics blocks only (nested in persona basics stack). */
  embedInParentStack?: boolean;
};

function BioSubsection({
  embedInSection,
  title,
  blockClassName,
  children,
}: {
  embedInSection: boolean;
  title: string;
  blockClassName?: string;
  children: ReactNode;
}) {
  if (embedInSection) {
    return (
      <PersonaV2SectionBlock title={title} className={blockClassName}>
        {children}
      </PersonaV2SectionBlock>
    );
  }
  return <MsqdxGlassDashboardCardSection title={title}>{children}</MsqdxGlassDashboardCardSection>;
}

export const MsqdxGlassBioCardEdit = ({
  profile,
  expanded,
  onToggle,
  onSave,
  savePending = false,
  embedInSection = false,
  embedInParentStack = false,
}: MsqdxGlassBioCardEditProps) => {
  const { t } = useI18n();
  const genderOptions = useMemo(
    () => [
      { value: "male", label: t("personaAdmin.genderMale") },
      { value: "female", label: t("personaAdmin.genderFemale") },
      { value: "diverse", label: t("personaAdmin.genderDiverse") },
    ],
    [t]
  );

  const bioEdit = useInlineEdit({
    initialValue: profile.bio ?? "",
    currentValue: profile.bio ?? "",
    isEqual: (a, b) => a === b,
    onChange: () => {},
  });

  const fullNameEdit = useInlineEdit({
    initialValue: profile.full_name ?? "",
    currentValue: profile.full_name ?? "",
    isEqual: (a, b) => a === b,
    onChange: () => {},
  });

  const ageEdit = useInlineEdit({
    initialValue: profile.age ?? null,
    currentValue: profile.age ?? null,
    isEqual: (a, b) => a === b,
    onChange: () => {},
  });

  const locationEdit = useInlineEdit({
    initialValue: profile.location ?? "",
    currentValue: profile.location ?? "",
    isEqual: (a, b) => a === b,
  });

  const genderEdit = useInlineEdit({
    initialValue: profile.gender ?? "",
    currentValue: profile.gender ?? "",
    isEqual: (a, b) => a === b,
  });

  const mediaAffinityEdit = useInlineEdit({
    initialValue: profile.media_affinity ?? null,
    currentValue: profile.media_affinity ?? null,
    isEqual: (a, b) => a === b,
  });

  useEffect(() => {
    if (!bioEdit.hasChanges && bioEdit.value !== (profile.bio ?? "")) {
      bioEdit.sync();
    }
    if (!fullNameEdit.hasChanges && fullNameEdit.value !== (profile.full_name ?? "")) {
      fullNameEdit.sync();
    }
    if (!ageEdit.hasChanges && ageEdit.value !== (profile.age ?? null)) {
      ageEdit.sync();
    }
    if (!locationEdit.hasChanges && locationEdit.value !== (profile.location ?? "")) {
      locationEdit.sync();
    }
    if (!genderEdit.hasChanges && genderEdit.value !== (profile.gender ?? "")) {
      genderEdit.sync();
    }
    if (!mediaAffinityEdit.hasChanges && mediaAffinityEdit.value !== (profile.media_affinity ?? null)) {
      mediaAffinityEdit.sync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    profile.bio,
    profile.full_name,
    profile.age,
    profile.location,
    profile.gender,
    profile.media_affinity,
    bioEdit.hasChanges,
    fullNameEdit.hasChanges,
    ageEdit.hasChanges,
    locationEdit.hasChanges,
    genderEdit.hasChanges,
    mediaAffinityEdit.hasChanges,
  ]);

  const bioRef = useRef<HTMLDivElement>(null);
  const fullNameRef = useRef<HTMLDivElement>(null);
  const ageRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);
  const genderRef = useRef<HTMLDivElement>(null);
  const mediaAffinityRef = useRef<HTMLDivElement>(null);

  const handleSaveBio = async () => {
    const v = bioEdit.getValue().trim();
    await onSave({ bio: v });
  };

  const handleSaveFullName = async () => {
    const v = fullNameEdit.getValue().trim();
    await onSave({ full_name: v || null });
  };

  const handleSaveAge = async () => {
    await onSave({ age: ageEdit.getValue() });
  };

  const handleSaveLocation = async () => {
    const locationValue = locationEdit.getValue();
    await onSave({ location: locationValue || null });
  };

  const handleSaveGender = async () => {
    const genderValue = genderEdit.getValue();
    const genderToSave = genderValue && genderValue.trim() !== "" ? genderValue : null;
    await onSave({ gender: genderToSave });
  };

  const handleSaveMediaAffinity = async () => {
    await onSave({ media_affinity: mediaAffinityEdit.getValue() });
  };

  const biographyBlock = (
    <BioSubsection
      embedInSection={embedInSection}
      title={t("personaAdmin.biography")}
      blockClassName="msqdx-glass-bio-stack__block --biography"
    >
      <Box ref={bioRef} sx={{ position: "relative" }}>
        <TextField
          multiline
          minRows={4}
          fullWidth
          size="small"
          label={t("personaAdmin.biography")}
          value={bioEdit.value}
          onChange={(e) => bioEdit.setValue(e.target.value)}
          placeholder={t("personaAdmin.biography")}
          disabled={savePending}
          sx={{ "& textarea": { lineHeight: 1.6 } }}
        />
        <MsqdxGlassInlineEditControls
          hasChanges={bioEdit.hasChanges}
          saving={savePending}
          onSave={handleSaveBio}
          onDiscard={() => bioEdit.reset()}
          anchorElement={bioRef.current}
          position="top"
        />
      </Box>
    </BioSubsection>
  );

  const demographicsBlock = (
    <BioSubsection
      embedInSection={embedInSection}
      title={t("personaAdmin.demographics")}
      blockClassName="msqdx-glass-bio-stack__block --demographics"
    >
      <Stack spacing={3}>
        <Box ref={fullNameRef} sx={{ position: "relative" }}>
          <MsqdxFormField
            label={t("personaAdmin.fullName")}
            value={fullNameEdit.value}
            onChange={(e) => fullNameEdit.setValue(e.target.value)}
            fullWidth
            disabled={savePending}
          />
          <MsqdxGlassInlineEditControls
            hasChanges={fullNameEdit.hasChanges}
            saving={savePending}
            onSave={handleSaveFullName}
            onDiscard={() => fullNameEdit.reset()}
            anchorElement={fullNameRef.current}
            position="top"
          />
        </Box>

        <Box ref={ageRef} sx={{ position: "relative" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="body2" component="label" sx={{ fontWeight: 500 }}>
              {t("personaAdmin.age")}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", minWidth: "60px", textAlign: "right" }}>
              {ageEdit.value !== null ? `${ageEdit.value} ${t("personaAdmin.years")}` : "—"}
            </Typography>
          </Box>
          <Slider
            value={ageEdit.value ?? 25}
            onChange={(_, value) =>
              ageEdit.setValue(typeof value === "number" ? value : (Array.isArray(value) ? value[0] : 25) ?? 25)
            }
            min={18}
            max={100}
            step={1}
            marks={[
              { value: 18, label: "18" },
              { value: 50, label: "50" },
              { value: 100, label: "100" },
            ]}
            sx={{ color: "var(--color-theme-accent)" }}
          />
          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              18
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              100
            </Typography>
          </Box>
          <MsqdxGlassInlineEditControls
            hasChanges={ageEdit.hasChanges}
            saving={savePending}
            onSave={handleSaveAge}
            onDiscard={() => ageEdit.reset()}
            anchorElement={ageRef.current}
            position="top"
          />
        </Box>

        <Box className="msqdx-glass-bio-demographics-field-row">
          <Box ref={genderRef} sx={{ position: "relative", minWidth: 0 }}>
            <MsqdxSelect
              label={t("personaAdmin.gender")}
              value={genderEdit.value}
              onChange={(e) => genderEdit.setValue(String(e.target.value ?? ""))}
              options={[{ value: "", label: t("personaAdmin.genderNone") }, ...genderOptions]}
              displayEmpty
              fullWidth
              size="small"
              sx={FORM_FIELD_ACCENT_SX}
            />
            <MsqdxGlassInlineEditControls
              hasChanges={genderEdit.hasChanges}
              saving={savePending}
              onSave={handleSaveGender}
              onDiscard={() => genderEdit.reset()}
              anchorElement={genderRef.current}
              position="top"
            />
          </Box>

          <Box ref={locationRef} sx={{ position: "relative", minWidth: 0 }}>
            <MsqdxFormField
              label={t("personaAdmin.location")}
              value={locationEdit.value}
              onChange={(e) => locationEdit.setValue(e.target.value)}
              placeholder={t("personaAdmin.locationPlaceholder")}
              fullWidth
            />
            <MsqdxGlassInlineEditControls
              hasChanges={locationEdit.hasChanges}
              saving={savePending}
              onSave={handleSaveLocation}
              onDiscard={() => locationEdit.reset()}
              anchorElement={locationRef.current}
              position="top"
            />
          </Box>
        </Box>

        <Box ref={mediaAffinityRef} sx={{ position: "relative" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="body2" component="label" sx={{ fontWeight: 500 }}>
              {t("personaAdmin.mediaAffinity")}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", minWidth: "80px", textAlign: "right" }}>
              {mediaAffinityEdit.value !== null ? `${mediaAffinityEdit.value}/100` : "—"}
            </Typography>
          </Box>
          <Slider
            value={mediaAffinityEdit.value ?? 50}
            onChange={(_, value) =>
              mediaAffinityEdit.setValue(typeof value === "number" ? value : (Array.isArray(value) ? value[0] : 50) ?? 50)
            }
            min={0}
            max={100}
            step={1}
            marks={[
              { value: 0, label: t("personaAdmin.skepticismLow") },
              { value: 50, label: "50" },
              { value: 100, label: t("personaAdmin.skepticismHigh") },
            ]}
            sx={{ color: "var(--color-theme-accent)" }}
          />
          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {t("personaAdmin.skepticismLow")}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {t("personaAdmin.skepticismHigh")}
            </Typography>
          </Box>
          <MsqdxGlassInlineEditControls
            hasChanges={mediaAffinityEdit.hasChanges}
            saving={savePending}
            onSave={handleSaveMediaAffinity}
            onDiscard={() => mediaAffinityEdit.reset()}
            anchorElement={mediaAffinityRef.current}
            position="top"
          />
        </Box>
      </Stack>
    </BioSubsection>
  );

  const body = embedInSection ? (
    <Stack component="section" className="msqdx-glass-bio-stack" spacing={0}>
      {biographyBlock}
      <MsqdxGlassPainGoalsSectorSeparator />
      {demographicsBlock}
    </Stack>
  ) : (
    <>
      {biographyBlock}
      {demographicsBlock}
    </>
  );

  if (embedInSection && embedInParentStack) {
    return <>{body}</>;
  }

  if (embedInSection) {
    return (
      <Box sx={{ gridColumn: "1 / -1", width: "100%" }} className="msqdx-glass-bio-section">
        {body}
        <style jsx global>{`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-4px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </Box>
    );
  }

  return (
    <Box sx={{ gridColumn: "1 / -1" }}>
      <MsqdxDashboardCard
        id="bio-demographics"
        title={t("personaAdmin.bioDemographics")}
        icon="person"
        iconColor={{ color: THEME_ACCENT.color }}
        expanded={expanded}
        onToggle={onToggle}
      >
        {body}
      </MsqdxDashboardCard>

      <style jsx global>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </Box>
  );
};
