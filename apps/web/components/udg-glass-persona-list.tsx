"use client";

import Link from "next/link";
import { Typography } from "@mui/material";
import type { PersonaListItem } from "@udg-glass/types";
import { MaterialSymbol } from "./material-symbol";

type UdgGlassPersonaListProps = {
  personas: PersonaListItem[];
  onSelect?: (personaId: string) => void;
  onDelete?: (personaId: string) => void;
  actionLabel?: string;
};

export const UdgGlassPersonaList = ({
  personas,
  onSelect,
  onDelete,
  actionLabel = "Chat",
}: UdgGlassPersonaListProps) => {
  if (personas.length === 0) {
    return (
      <div className="udg-glass-empty">
        <Typography variant="body2">No personas in this Target Group.</Typography>
      </div>
    );
  }

  return (
    <div className="udg-glass-list">
      {personas.map((persona) => (
        <div
          key={persona.id}
          className="udg-glass-list-item"
        >
          <div className="udg-glass-list-item__row">
            <strong>{persona.name}</strong>
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <span className="udg-glass-chip --draft">{persona.status}</span>
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
                  className="udg-glass-button --ghost"
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

UdgGlassPersonaList.displayName = "udg-glass-persona-list";

