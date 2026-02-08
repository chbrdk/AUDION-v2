"use client";

import Link from "next/link";
import { MsqdxTypography } from "@msqdx/react";
import type { PersonaListItem } from "@msqdx-glass/types";
import { MsqdxIcon } from "@msqdx/react";

type MsqdxGlassPersonaListProps = {
  personas: PersonaListItem[];
  onSelect?: (personaId: string) => void;
  onDelete?: (personaId: string) => void;
  actionLabel?: string;
};

export const MsqdxGlassPersonaList = ({
  personas,
  onSelect,
  onDelete,
  actionLabel = "Chat",
}: MsqdxGlassPersonaListProps) => {
  if (personas.length === 0) {
    return (
      <div className="msqdx-glass-empty">
        <MsqdxTypography variant="body2">No personas in this Target Group.</MsqdxTypography>
      </div>
    );
  }

  return (
    <div className="msqdx-glass-list">
      {personas.map((persona) => (
        <div
          key={persona.id}
          className="msqdx-glass-list-item"
        >
          <div className="msqdx-glass-list-item__row">
            <strong>{persona.name}</strong>
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <span className="msqdx-glass-chip --draft">{persona.status}</span>
              <Link
                href={`/personas/admin?selected=${persona.id}`}
                onClick={(e) => {
                  if (onSelect) {
                    e.preventDefault();
                    onSelect(persona.id);
                  }
                }}
                style={{ display: "flex", alignItems: "center", padding: "0.375rem" }}
                title="Open persona"
              >
                <MsqdxIcon name="open_in_new" customSize={18} />
              </Link>
              {onDelete && (
                <button
                  type="button"
                  className="msqdx-glass-button --ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete the persona "${persona.name}"?`)) {
                      onDelete(persona.id);
                    }
                  }}
                  style={{ padding: "0.375rem", fontSize: "0.75rem", color: "var(--color-secondary-dx-pink)" }}
                  title="Delete persona"
                >
                  <MsqdxIcon name="delete" customSize={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

MsqdxGlassPersonaList.displayName = "msqdx-glass-persona-list";

