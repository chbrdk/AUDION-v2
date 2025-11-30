"use client";

import { useState, useEffect } from "react";
import { MaterialSymbol } from "../material-symbol";
import { journeysApi, type JourneyResponse } from "../../app/api/_lib/journeys";
import { targetGroupsApi, type TargetGroupResponse } from "../../app/api/_lib/target-groups";

interface VariableContextPanelProps {
  context: Record<string, string>;
  onChange: (context: Record<string, string>) => void;
  requiredVars?: string[];
}

interface PersonaItem {
  id: string;
  name: string;
}

interface PhaseItem {
  id: string;
  name: string;
  phase_order?: number;
}

export function VariableContextPanel({ context, onChange, requiredVars = [] }: VariableContextPanelProps) {
  const [personas, setPersonas] = useState<PersonaItem[]>([]);
  const [journeys, setJourneys] = useState<JourneyResponse[]>([]);
  const [targetGroups, setTargetGroups] = useState<TargetGroupResponse[]>([]);
  const [phases, setPhases] = useState<PhaseItem[]>([]);
  const [loading, setLoading] = useState({
    personas: false,
    journeys: false,
    targetGroups: false,
    phases: false,
  });

  // Load personas
  useEffect(() => {
    const loadPersonas = async () => {
      setLoading((prev) => ({ ...prev, personas: true }));
      try {
        const response = await fetch("/api/persona-admin?page_size=100");
        if (response.ok) {
          const data = await response.json();
          const items = Array.isArray(data) ? data : data.items || [];
          setPersonas(
            items.map((p: any) => ({
              id: p.id,
              name: p.name || p.profile?.name || "Unnamed Persona",
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load personas:", err);
      } finally {
        setLoading((prev) => ({ ...prev, personas: false }));
      }
    };
    loadPersonas();
  }, []);

  // Load journeys
  useEffect(() => {
    const loadJourneys = async () => {
      setLoading((prev) => ({ ...prev, journeys: true }));
      try {
        const data = await journeysApi.listJourneys({ page_size: 100 });
        setJourneys(data);
      } catch (err) {
        console.error("Failed to load journeys:", err);
      } finally {
        setLoading((prev) => ({ ...prev, journeys: false }));
      }
    };
    loadJourneys();
  }, []);

  // Load target groups
  useEffect(() => {
    const loadTargetGroups = async () => {
      setLoading((prev) => ({ ...prev, targetGroups: true }));
      try {
        const data = await targetGroupsApi.listTargetGroups({ page_size: 100 });
        setTargetGroups(data.items || []);
      } catch (err) {
        console.error("Failed to load target groups:", err);
      } finally {
        setLoading((prev) => ({ ...prev, targetGroups: false }));
      }
    };
    loadTargetGroups();
  }, []);

  // Load phases when journey_id changes
  useEffect(() => {
    const loadPhases = async () => {
      if (!context.journey_id) {
        setPhases([]);
        return;
      }
      setLoading((prev) => ({ ...prev, phases: true }));
      try {
        const journey = journeys.find((j) => j.id === context.journey_id);
        if (journey && journey.phases) {
          const sortedPhases = [...journey.phases].sort((a, b) => (a.phase_order || 0) - (b.phase_order || 0));
          setPhases(
            sortedPhases.map((p) => ({
              id: p.id,
              name: p.name,
              phase_order: p.phase_order,
            }))
          );
        } else {
          // Fetch journey details if not in cache
          const journeyDetails = await journeysApi.getJourney(context.journey_id);
          if (journeyDetails.phases) {
            const sortedPhases = [...journeyDetails.phases].sort((a, b) => (a.phase_order || 0) - (b.phase_order || 0));
            setPhases(
              sortedPhases.map((p) => ({
                id: p.id,
                name: p.name,
                phase_order: p.phase_order,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load phases:", err);
        setPhases([]);
      } finally {
        setLoading((prev) => ({ ...prev, phases: false }));
      }
    };
    loadPhases();
  }, [context.journey_id, journeys]);

  const handleChange = (key: string, value: string) => {
    const newContext = { ...context, [key]: value };
    // Clear phase_id if journey_id changes
    if (key === "journey_id" && value !== context.journey_id) {
      delete newContext.phase_id;
    }
    onChange(newContext);
  };

  const isRequired = (key: string) => requiredVars.includes(key);
  const isEmpty = (key: string) => !context[key] || context[key].trim() === "";

  const renderSelect = (
    key: string,
    label: string,
    options: Array<{ id: string; name: string; phase_order?: number }>,
    isLoading: boolean
  ) => (
    <div key={key}>
      <label
        style={{
          display: "block",
          marginBottom: "0.25rem",
          fontSize: "0.75rem",
          fontWeight: 500,
          color: "var(--color-text-primary)",
        }}
      >
        {label}
        {isRequired(key) && (
          <span style={{ color: "rgba(239, 68, 68, 1)", marginLeft: "0.25rem" }}>*</span>
        )}
      </label>
      <div style={{ position: "relative" }}>
        <select
          value={context[key] || ""}
          onChange={(e) => handleChange(key, e.target.value)}
          disabled={isLoading}
          style={{
            width: "100%",
            padding: "0.5rem",
            paddingRight: isEmpty(key) && isRequired(key) ? "2rem" : "0.5rem",
            border: isEmpty(key) && isRequired(key)
              ? "1px solid rgba(234, 179, 8, 0.5)"
              : "1px solid rgba(148, 163, 184, 0.2)",
            borderRadius: "6px",
            fontSize: "0.8125rem",
            background: "transparent",
            color: "var(--color-text-primary)",
            cursor: isLoading ? "wait" : "pointer",
            transition: "background 0.2s ease, border-color 0.2s ease",
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
          }}
          onFocus={(e) => {
            e.target.style.background = "var(--color-neutral)";
            e.target.style.borderColor = "var(--color-theme-accent)";
          }}
          onBlur={(e) => {
            e.target.style.background = "transparent";
            e.target.style.borderColor = isEmpty(key) && isRequired(key)
              ? "rgba(234, 179, 8, 0.5)"
              : "rgba(148, 163, 184, 0.2)";
          }}
        >
          <option value="">{isLoading ? "Loading..." : `Select ${label.toLowerCase()}...`}</option>
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.phase_order !== undefined
                ? `Phase ${item.phase_order}: ${item.name}`
                : item.name}
            </option>
          ))}
        </select>
        {isEmpty(key) && isRequired(key) && (
          <MaterialSymbol
            icon="warning"
            fontSize={16}
            style={{
              position: "absolute",
              right: "0.5rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "rgba(234, 179, 8, 1)",
              pointerEvents: "none",
            }}
          />
        )}
        <MaterialSymbol
          icon="arrow_drop_down"
          fontSize={20}
          style={{
            position: "absolute",
            right: "0.5rem",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--color-text-secondary)",
            pointerEvents: "none",
            opacity: 0.6,
          }}
        />
      </div>
      {isEmpty(key) && isRequired(key) && (
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.625rem", color: "rgba(234, 179, 8, 1)" }}>
          Required for extended variables
        </p>
      )}
    </div>
  );

  return (
    <div
      style={{
        padding: "1rem",
        background: "var(--color-neutral)",
        borderTop: "1px solid rgba(148, 163, 184, 0.2)",
      }}
    >
      <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Test Context
      </h4>
      <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
        Select entities to test extended variables with real data
      </p>

      <div style={{ display: "grid", gap: "0.75rem" }}>
        {renderSelect("persona_id", "Persona", personas, loading.personas)}
        {renderSelect("target_group_id", "Target Group", targetGroups, loading.targetGroups)}
        {renderSelect("journey_id", "Journey", journeys, loading.journeys)}
        {renderSelect(
          "phase_id",
          "Phase",
          phases,
          loading.phases || !context.journey_id
        )}
      </div>
    </div>
  );
}

