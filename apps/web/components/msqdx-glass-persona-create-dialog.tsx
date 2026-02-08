"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import type { TargetGroupPersonaGenerateRequest } from "../app/api/_lib/target-group";
import { MsqdxIcon } from "@msqdx/react";

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
  const [form, setForm] = useState<QuickCreateFormState>(defaultQuickFormState);

  if (!open) {
    return null;
  }

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
    };

    try {
      await onSubmit(request);
      setForm(defaultQuickFormState);
    } catch (error) {
      // Error handling is done in parent component
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
    <div
      className="msqdx-glass-modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={handleClose}
    >
      <div
        className="msqdx-glass-modal"
        style={{
          backgroundColor: "var(--color-background)",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "500px",
          width: "90%",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ margin: 0 }}>Neue Persona erstellen</h2>
          <button
            type="button"
            className="msqdx-glass-button --ghost"
            onClick={handleClose}
            disabled={loading}
            style={{ padding: "8px" }}
          >
            <MsqdxIcon name="close" customSize={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="msqdx-glass-field" style={{ marginBottom: "16px" }}>
            <label htmlFor="segment">
              Segment Name <span style={{ color: "var(--color-error)" }}>*</span>
            </label>
            <input
              id="segment"
              type="text"
              value={form.segment}
              onChange={(e) => handleFieldChange("segment", e.target.value)}
              placeholder="z.B. Skeptischer CFO, Technikaffiner CTO"
              required
              disabled={loading}
              style={{ width: "100%" }}
            />
            <p style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: "4px" }}>
              Kurze Beschreibung des Persona-Segments
            </p>
          </div>

          <div className="msqdx-glass-field" style={{ marginBottom: "24px" }}>
            <label htmlFor="description">Beschreibung (optional)</label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => handleFieldChange("description", e.target.value)}
              placeholder="Optionale Beschreibung was diese Persona repräsentiert"
              rows={3}
              disabled={loading}
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="msqdx-glass-button --ghost"
              onClick={handleClose}
              disabled={loading}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="msqdx-glass-button"
              disabled={loading || !form.segment.trim()}
            >
              {loading ? (
                <>
                  <MsqdxIcon name="hourglass_empty" customSize={18} /> Erstelle...
                </>
              ) : (
                <>
                  <MsqdxIcon name="add" customSize={18} /> Erstellen
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

MsqdxGlassPersonaCreateDialog.displayName = "msqdx-glass-persona-create-dialog";

