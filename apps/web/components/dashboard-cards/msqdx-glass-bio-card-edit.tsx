"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { PersonaProfile } from "@msqdx-glass/types";
import { Box, Slider, Typography, Stack } from "@mui/material";
import { MsqdxIcon, MsqdxDashboardCard, MsqdxSelect, MsqdxFormField } from "@msqdx/react";
import { MsqdxGlassDashboardCardSection } from "./msqdx-glass-dashboard-card-section";
import { useI18n } from "../i18n/i18n-provider";
import { FORM_FIELD_ACCENT_SX, THEME_ACCENT } from "../../lib/theme-accent";
import { MsqdxGlassInlineEditControls } from "../msqdx-glass-inline-edit-controls";
import { useInlineEdit } from "../hooks/use-inline-edit";

export type MsqdxGlassBioCardEditProps = {
  profile: PersonaProfile;
  expanded: boolean;
  onToggle: (id: string) => void;
  onSave: (updates: Partial<PersonaProfile>) => Promise<void>;
  savePending?: boolean;
};

export const MsqdxGlassBioCardEdit = ({
  profile,
  expanded,
  onToggle,
  onSave,
  savePending = false
}: MsqdxGlassBioCardEditProps) => {
  const { t } = useI18n();
  const genderOptions = useMemo(() => [
    { value: "male", label: t("personaAdmin.genderMale") },
    { value: "female", label: t("personaAdmin.genderFemale") },
    { value: "diverse", label: t("personaAdmin.genderDiverse") },
  ], [t]);
  // Individual inline edit hooks for each field
  const ageEdit = useInlineEdit({
    initialValue: profile.age ?? null,
    currentValue: profile.age ?? null,
    isEqual: (a, b) => a === b,
    onChange: () => {
      // Trigger re-render when value changes
    }
  });

  const locationEdit = useInlineEdit({
    initialValue: profile.location ?? "",
    currentValue: profile.location ?? "",
    isEqual: (a, b) => a === b
  });

  const genderEdit = useInlineEdit({
    initialValue: profile.gender ?? "",
    currentValue: profile.gender ?? "",
    isEqual: (a, b) => a === b
  });

  const mediaAffinityEdit = useInlineEdit({
    initialValue: profile.media_affinity ?? null,
    currentValue: profile.media_affinity ?? null,
    isEqual: (a, b) => a === b
  });

  // Sync from server when profile fields change — never while that field has local unsaved edits
  // (otherwise any refreshed profile field resets sliders/inputs the user is still adjusting).
  useEffect(() => {
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
    profile.age,
    profile.location,
    profile.gender,
    profile.media_affinity,
    ageEdit.hasChanges,
    locationEdit.hasChanges,
    genderEdit.hasChanges,
    mediaAffinityEdit.hasChanges,
  ]);

  // Element refs for positioning
  const ageRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);
  const genderRef = useRef<HTMLDivElement>(null);
  const mediaAffinityRef = useRef<HTMLDivElement>(null);

  const handleSaveAge = async () => {
    const ageValue = ageEdit.getValue();
    const updates: Partial<PersonaProfile> = {
      age: ageValue
    };
    await onSave(updates);
  };

  const handleSaveLocation = async () => {
    const locationValue = locationEdit.getValue();
    const updates: Partial<PersonaProfile> = {
      location: locationValue || null
    };
    await onSave(updates);
  };

  const handleSaveGender = async () => {
    const genderValue = genderEdit.getValue();
    // Send empty string as null, otherwise send the value as-is
    const genderToSave = (genderValue && genderValue.trim() !== "") ? genderValue : null;
    const updates: Partial<PersonaProfile> = {
      gender: genderToSave
    };
    await onSave(updates);
  };

  const handleSaveMediaAffinity = async () => {
    const mediaAffinityValue = mediaAffinityEdit.getValue();
    const updates: Partial<PersonaProfile> = {
      media_affinity: mediaAffinityValue
    };
    await onSave(updates);
  };

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
        {profile.bio && (
          <MsqdxGlassDashboardCardSection title={t("personaAdmin.biography")}>
            <p style={{ lineHeight: "1.6", whiteSpace: "pre-wrap", margin: 0 }}>
              {profile.bio}
            </p>
          </MsqdxGlassDashboardCardSection>
        )}

        <MsqdxGlassDashboardCardSection title={t("personaAdmin.demographics")}>
          <Stack spacing={3}>
            {/* Age Slider */}
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
                onChange={(_, value) => ageEdit.setValue(typeof value === "number" ? value : (Array.isArray(value) ? value[0] : 25) ?? 25)}
                min={18}
                max={100}
                step={1}
                marks={[
                  { value: 18, label: "18" },
                  { value: 50, label: "50" },
                  { value: 100, label: "100" }
                ]}
                sx={{ color: "var(--color-theme-accent)" }}
              />
              <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>18</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>100</Typography>
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

            {/* Gender Select */}
            <Box ref={genderRef} sx={{ position: "relative" }}>
              <MsqdxSelect
                label={t("personaAdmin.gender")}
                value={genderEdit.value}
                onChange={(e) => genderEdit.setValue(String(e.target.value ?? ""))}
                options={[
                  { value: "", label: t("personaAdmin.genderNone") },
                  ...genderOptions
                ]}
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

            {/* Location Text Field */}
            <Box ref={locationRef} sx={{ position: "relative" }}>
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

            {/* Media Affinity Slider */}
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
                onChange={(_, value) => mediaAffinityEdit.setValue(typeof value === "number" ? value : (Array.isArray(value) ? value[0] : 50) ?? 50)}
                min={0}
                max={100}
                step={1}
                marks={[
                  { value: 0, label: t("personaAdmin.skepticismLow") },
                  { value: 50, label: "50" },
                  { value: 100, label: t("personaAdmin.skepticismHigh") }
                ]}
                sx={{ color: "var(--color-theme-accent)" }}
              />
              <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>{t("personaAdmin.skepticismLow")}</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>{t("personaAdmin.skepticismHigh")}</Typography>
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
        </MsqdxGlassDashboardCardSection>
      </MsqdxDashboardCard>

      {/* Add CSS animation for slideIn */}
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
