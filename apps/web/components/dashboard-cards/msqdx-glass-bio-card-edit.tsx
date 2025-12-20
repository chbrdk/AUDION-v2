"use client";

import { useState, useEffect, useRef } from "react";
import type { PersonaProfile } from "@msqdx-glass/types";
import { Box, Slider, TextField, MenuItem, Select, FormControl, InputLabel, Typography, Stack } from "@mui/material";
import { MaterialSymbol } from "../material-symbol";
import { MsqdxGlassDashboardCard } from "./msqdx-glass-dashboard-card";
import { MsqdxGlassDashboardCardSection } from "./msqdx-glass-dashboard-card-section";
import { MsqdxGlassInlineEditControls } from "../msqdx-glass-inline-edit-controls";
import { useInlineEdit } from "../hooks/use-inline-edit";

export type MsqdxGlassBioCardEditProps = {
  profile: PersonaProfile;
  expanded: boolean;
  onToggle: (id: string) => void;
  onSave: (updates: Partial<PersonaProfile>) => Promise<void>;
  savePending?: boolean;
};

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "diverse", label: "Diverse" }
];

export const MsqdxGlassBioCardEdit = ({
  profile,
  expanded,
  onToggle,
  onSave,
  savePending = false
}: MsqdxGlassBioCardEditProps) => {
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

  // Sync all hooks when profile changes (after save)
  useEffect(() => {
    // Only sync if values are different to avoid unnecessary updates
    if (ageEdit.value !== (profile.age ?? null)) {
      ageEdit.sync();
    }
    if (locationEdit.value !== (profile.location ?? "")) {
      locationEdit.sync();
    }
    if (genderEdit.value !== (profile.gender ?? "")) {
      genderEdit.sync();
    }
    if (mediaAffinityEdit.value !== (profile.media_affinity ?? null)) {
      mediaAffinityEdit.sync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.age, profile.location, profile.gender, profile.media_affinity]);

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
    <>
      <MsqdxGlassDashboardCard
        id="bio-demographics"
        title="Biography & Demographics"
        icon="person"
        variant="bio"
        fullWidth={true}
        iconColor={{
          color: "var(--color-theme-accent)"
        }}
        borderColor="var(--color-theme-accent)"
        expanded={expanded}
        onToggle={onToggle}
      >
        {profile.bio && (
          <MsqdxGlassDashboardCardSection title="Biography">
            <p style={{ lineHeight: "1.6", whiteSpace: "pre-wrap", margin: 0 }}>
              {profile.bio}
            </p>
          </MsqdxGlassDashboardCardSection>
        )}

        <MsqdxGlassDashboardCardSection title="Demographics">
          <Stack spacing={3}>
            {/* Age Slider */}
            <Box ref={ageRef} sx={{ position: "relative" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="body2" component="label" sx={{ fontWeight: 500 }}>
                  Age
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", minWidth: "60px", textAlign: "right" }}>
                  {ageEdit.value !== null ? `${ageEdit.value} years` : "—"}
                </Typography>
              </Box>
              <Slider
                value={ageEdit.value ?? 25}
                onChange={(_, value) => ageEdit.setValue(typeof value === "number" ? value : value[0])}
                min={18}
                max={100}
                step={1}
                marks={[
                  { value: 18, label: "18" },
                  { value: 50, label: "50" },
                  { value: 100, label: "100" }
                ]}
                sx={{
                  '& .MuiSlider-thumb': {
                    width: 20,
                    height: 20
                  }
                }}
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
              <FormControl fullWidth size="small">
                <InputLabel id="gender-select-label">Gender</InputLabel>
                <Select
                  labelId="gender-select-label"
                  id="gender-select"
                  value={genderEdit.value}
                  label="Gender"
                  onChange={(e) => genderEdit.setValue(e.target.value)}
                  displayEmpty
                  sx={{
                    '& .MuiSelect-select': {
                      display: "flex",
                      alignItems: "center"
                    }
                  }}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {GENDER_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
              <TextField
                label="Location"
                value={locationEdit.value}
                onChange={(e) => locationEdit.setValue(e.target.value)}
                placeholder="e.g., Berlin, Germany"
                fullWidth
                size="small"
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
                  Media Affinity
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", minWidth: "80px", textAlign: "right" }}>
                  {mediaAffinityEdit.value !== null ? `${mediaAffinityEdit.value}/100` : "—"}
                </Typography>
              </Box>
              <Slider
                value={mediaAffinityEdit.value ?? 50}
                onChange={(_, value) => mediaAffinityEdit.setValue(typeof value === "number" ? value : value[0])}
                min={0}
                max={100}
                step={1}
                marks={[
                  { value: 0, label: "Low" },
                  { value: 50, label: "50" },
                  { value: 100, label: "High" }
                ]}
                sx={{
                  '& .MuiSlider-thumb': {
                    width: 20,
                    height: 20
                  }
                }}
              />
              <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>Low</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>High</Typography>
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
      </MsqdxGlassDashboardCard>
      
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
    </>
  );
};
