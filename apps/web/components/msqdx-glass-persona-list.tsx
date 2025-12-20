"use client";

import Link from "next/link";
import { Typography } from "@mui/material";
import type { PersonaListItem } from "@msqdx-glass/types";
import { MaterialSymbol } from "./material-symbol";

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
        <Typography variant="body2">No personas in this Target Group.</Typography>
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
                <MaterialSymbol icon="open_in_new" fontSize={18} />
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
                  <MaterialSymbol icon="delete" fontSize={18} />
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

