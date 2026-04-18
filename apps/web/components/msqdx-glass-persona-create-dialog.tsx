"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Box } from "@mui/material";
import type { TargetGroupPersonaGenerateRequest } from "../app/api/_lib/target-group";
import { MsqdxIcon, MsqdxDialog, MsqdxFormField, MsqdxTextareaField, MsqdxButton } from "@msqdx/react";
import { useI18n } from "./i18n/i18n-provider";

type MsqdxGlassPersonaCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (request: TargetGroupPersonaGenerateRequest) => Promise<void>;
  loading?: boolean;
};

type QuickCreateFormState = {
  segment: string;
  description: string;
};

const defaultQuickFormState: QuickCreateFormState = {
  segment: "",
  description: "",
};

export const MsqdxGlassPersonaCreateDialog = ({
  open,
  onClose,
  onSubmit,
  loading = false,
}: MsqdxGlassPersonaCreateDialogProps) => {
  const { t, locale } = useI18n();
  const [form, setForm] = useState<QuickCreateFormState>(defaultQuickFormState);

  const handleFieldChange = (field: keyof QuickCreateFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.segment.trim()) {
      return;
    }

    const request: TargetGroupPersonaGenerateRequest = {
      segment: form.segment.trim(),
      description: form.description.trim() || undefined,
      filterMode: "auto",
      outputLocale: locale,
    };

    try {
      await onSubmit(request);
      setForm(defaultQuickFormState);
    } catch (error) {
      throw error;
    }
  };

  const handleClose = () => {
    if (!loading) {
      setForm(defaultQuickFormState);
      onClose();
    }
  };

  return (
    <MsqdxDialog
      open={open}
      onClose={handleClose}
      title={t("targetGroupsAdmin.createPersona")}
      size="sm"
      brandColor="green"
    >
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <MsqdxFormField
            label={t("targetGroupsAdmin.segmentName")}
            required
            value={form.segment}
            onChange={(e) => handleFieldChange("segment", e.target.value)}
            placeholder={t("targetGroupsAdmin.segmentPlaceholderPersona")}
            disabled={loading}
            fullWidth
            helperText={t("targetGroupsAdmin.segmentHelperText")}
          />
          <MsqdxTextareaField
            label={t("targetGroupsAdmin.descriptionOptional")}
            value={form.description}
            onChange={(e) => handleFieldChange("description", e.target.value)}
            placeholder={t("targetGroupsAdmin.descriptionOptionalPlaceholder")}
            minRows={3}
            disabled={loading}
            fullWidth
          />
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end", mt: 2 }}>
          <MsqdxButton variant="text" onClick={handleClose} disabled={loading}>
            {t("common.cancel")}
          </MsqdxButton>
          <MsqdxButton
            type="submit"
            variant="contained"
            brandColor="green"
            disabled={loading || !form.segment.trim()}
            startIcon={<MsqdxIcon name={loading ? "hourglass_empty" : "add"} customSize={18} />}
          >
            {loading ? t("targetGroupsAdmin.creating") : t("targetGroupsAdmin.createButton")}
          </MsqdxButton>
        </Box>
      </form>
    </MsqdxDialog>
  );
};

MsqdxGlassPersonaCreateDialog.displayName = "msqdx-glass-persona-create-dialog";

