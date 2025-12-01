"use client";

import { useState, useMemo } from "react";
import { MaterialSymbol } from "../material-symbol";
import { STANDARD_VARIABLES, EXTENDED_VARIABLES, type VariableDefinition, type VariableCategory } from "./variableDefinitions";

interface VariablePaletteProps {
  onVariableDrag?: (variable: VariableDefinition) => void;
  onVariableClick?: (variable: VariableDefinition) => void;
}

export function VariablePalette({ onVariableDrag, onVariableClick }: VariablePaletteProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<VariableCategory>>(
    new Set()
  );
  const [isStandardExpanded, setIsStandardExpanded] = useState(false);
  const [isExtendedExpanded, setIsExtendedExpanded] = useState(false);

  const filteredStandard = useMemo(() => {
    if (!searchQuery) return STANDARD_VARIABLES;
    const query = searchQuery.toLowerCase();
    return STANDARD_VARIABLES.filter(
      (v) =>
        v.name.toLowerCase().includes(query) ||
        v.description.toLowerCase().includes(query) ||
        v.syntax.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const filteredExtended = useMemo(() => {
    if (!searchQuery) return EXTENDED_VARIABLES;
    const query = searchQuery.toLowerCase();
    return EXTENDED_VARIABLES.filter(
      (v) =>
        v.name.toLowerCase().includes(query) ||
        v.description.toLowerCase().includes(query) ||
        v.syntax.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const groupedStandard = useMemo(() => {
    const groups: Record<string, VariableDefinition[]> = {};
    filteredStandard.forEach((v) => {
      if (!groups[v.category]) {
        groups[v.category] = [];
      }
      groups[v.category].push(v);
    });
    return groups;
  }, [filteredStandard]);

  const toggleCategory = (category: VariableCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, variable: VariableDefinition) => {
    e.dataTransfer.setData("text/variable-syntax", variable.syntax);
    e.dataTransfer.setData("text/variable-name", variable.name);
    e.dataTransfer.effectAllowed = "copy";
    if (onVariableDrag) {
      onVariableDrag(variable);
    }
  };

  const handleVariableClick = (variable: VariableDefinition) => {
    if (onVariableClick) {
      onVariableClick(variable);
    }
  };

  const renderVariable = (variable: VariableDefinition) => (
    <div
      key={variable.name}
      draggable
      onDragStart={(e) => handleDragStart(e, variable)}
      style={{
        padding: "0.625rem",
        background: "transparent",
        borderRadius: "6px",
        border: "1px solid rgba(148, 163, 184, 0.2)",
        cursor: "grab",
        marginBottom: "0.5rem",
        transition: "all 0.2s ease",
        display: "flex",
        alignItems: "start",
        gap: "0.5rem"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(182, 56, 255, 0.1)";
        e.currentTarget.style.borderColor = "var(--color-theme-accent)";
        e.currentTarget.style.cursor = "grabbing";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.2)";
        e.currentTarget.style.cursor = "grab";
      }}
    >
      <MaterialSymbol icon="drag_indicator" fontSize={16} style={{ color: "var(--color-text-secondary)", marginTop: "0.125rem", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <code
          style={{
            background: "rgba(182, 56, 255, 0.15)",
            color: "var(--color-theme-accent)",
            padding: "0.25rem 0.5rem",
            borderRadius: "4px",
            fontSize: "0.75rem",
            fontWeight: 600,
            fontFamily: "monospace",
            display: "block",
            marginBottom: "0.25rem",
            wordBreak: "break-all",
          }}
        >
          {variable.syntax}
        </code>
        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-secondary)", lineHeight: "1.4" }}>
          {variable.description}
        </p>
        {variable.requiresContext && variable.requiresContext.length > 0 && (
          <div style={{ marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem", flexWrap: "wrap" }}>
            {variable.requiresContext.map((ctx) => (
              <span
                key={ctx}
                style={{
                  fontSize: "0.625rem",
                  padding: "0.125rem 0.375rem",
                  background: "rgba(234, 179, 8, 0.15)",
                  color: "rgba(234, 179, 8, 1)",
                  borderRadius: "3px",
                  fontWeight: 500,
                }}
              >
                Requires: {ctx}
              </span>
            ))}
          </div>
        )}
      </div>
      {onVariableClick && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleVariableClick(variable);
          }}
          style={{
            marginLeft: "auto",
            padding: "0.375rem 0.75rem",
            background: "var(--color-theme-accent)",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "0.75rem",
            fontWeight: 500,
            transition: "all 0.2s ease",
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(182, 56, 255, 0.8)";
            e.currentTarget.style.transform = "scale(1.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--color-theme-accent)";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          Insert
        </button>
      )}
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--color-neutral)",
        borderRight: "1px solid rgba(148, 163, 184, 0.2)",
      }}
    >
      <div style={{ padding: "1rem", borderBottom: "1px solid rgba(148, 163, 184, 0.2)", background: "var(--color-neutral)" }}>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-primary)" }}>
          Variables
        </h3>
        <div style={{ position: "relative" }}>
          <MaterialSymbol
            icon="search"
            fontSize={18}
            style={{
              position: "absolute",
              left: "0.5rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-secondary)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search variables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem 0.5rem 0.5rem 2rem",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: "6px",
              fontSize: "0.8125rem",
              background: "transparent",
              transition: "background 0.2s ease",
            }}
            onFocus={(e) => {
              e.target.style.background = "var(--color-neutral)";
            }}
            onBlur={(e) => {
              e.target.style.background = "transparent";
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
        {/* Standard Variables */}
        <div style={{ marginBottom: "1.5rem" }}>
          <button
            type="button"
            onClick={() => setIsStandardExpanded(!isStandardExpanded)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.5rem",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              marginBottom: "0.5rem",
            }}
          >
            <h4 style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Standard Variables
            </h4>
            <MaterialSymbol
              icon={isStandardExpanded ? "expand_less" : "expand_more"}
              fontSize={18}
              style={{ color: "var(--color-text-secondary)" }}
            />
          </button>
          {isStandardExpanded && (
            <div>
              {Object.entries(groupedStandard).map(([category, vars]) => {
                const isCategoryExpanded = expandedCategories.has(category as VariableCategory);
                return (
                  <div key={category} style={{ marginBottom: "1rem" }}>
                    <button
                      type="button"
                      onClick={() => toggleCategory(category as VariableCategory)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.5rem",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        marginBottom: "0.5rem",
                        borderRadius: "4px",
                        transition: "background 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(148, 163, 184, 0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <h5 style={{ margin: 0, fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "capitalize" }}>
                        {category}
                      </h5>
                      <MaterialSymbol
                        icon={isCategoryExpanded ? "expand_less" : "expand_more"}
                        fontSize={16}
                        style={{ color: "var(--color-text-secondary)" }}
                      />
                    </button>
                    {isCategoryExpanded && (
                      <div>
                        {vars.map(renderVariable)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Extended Variables */}
        <div>
          <button
            type="button"
            onClick={() => setIsExtendedExpanded(!isExtendedExpanded)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.5rem",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              marginBottom: "0.5rem",
            }}
          >
            <h4 style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Extended Variables
            </h4>
            <MaterialSymbol
              icon={isExtendedExpanded ? "expand_less" : "expand_more"}
              fontSize={18}
              style={{ color: "var(--color-text-secondary)" }}
            />
          </button>
          {isExtendedExpanded && (
            <div>
              {filteredExtended.map(renderVariable)}
              {filteredExtended.length === 0 && (
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", fontStyle: "italic", padding: "0.5rem" }}>
                  No extended variables match your search
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

