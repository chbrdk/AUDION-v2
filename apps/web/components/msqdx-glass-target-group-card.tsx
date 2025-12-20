"use client";

import type { TargetGroupListItem } from "@msqdx-glass/types";

import { MaterialSymbol } from "./material-symbol";

type MsqdxGlassTargetGroupCardProps = {
  targetGroup: TargetGroupListItem;
  selected?: boolean;
  onSelect?: (targetGroupId: string) => void;
};

export const MsqdxGlassTargetGroupCard = ({
  targetGroup,
  selected,
  onSelect,
}: MsqdxGlassTargetGroupCardProps) => {
  return (
    <div
      className={`msqdx-glass-card ${selected ? "is-selected" : ""}`}
      onClick={() => onSelect?.(targetGroup.id)}
      style={{
        cursor: onSelect ? "pointer" : "default",
        padding: "1rem",
        border: "1px solid var(--color-neutral)",
        borderRadius: "8px",
        transition: "all 150ms ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
        <MaterialSymbol icon="groups" fontSize={24} />
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>
            {targetGroup.name}
          </h3>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--color-secondary-dx-grey-light)" }}>
            {targetGroup.segment}
          </p>
        </div>
      </div>
      {targetGroup.description && (
        <p style={{ margin: "0.5rem 0", fontSize: "0.875rem", color: "var(--color-neutral)" }}>
          {targetGroup.description}
        </p>
      )}
      <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", fontSize: "0.875rem" }}>
        <span>
          <MaterialSymbol icon="person" fontSize={16} style={{ verticalAlign: "middle" }} />{" "}
          {targetGroup.personaCount} Personas
        </span>
        <span>
          <MaterialSymbol icon="book" fontSize={16} style={{ verticalAlign: "middle" }} />{" "}
          {targetGroup.knowledgeEntryCount} Knowledge
        </span>
      </div>
    </div>
  );
};

