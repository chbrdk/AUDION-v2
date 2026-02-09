"use client";

// Disable static generation to prevent prerendering issues with useState/useContext
export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { journeysApi, type JourneyResponse } from "../../api/_lib/journeys";
import { MsqdxIcon } from "@msqdx/react";
import { useProject } from "../../../components/projects/project-provider";
import { useI18n } from "../../../components/i18n/i18n-provider";

export default function JourneysListPage() {
  const { activeProjectId } = useProject();
  const { t } = useI18n();
  const [journeys, setJourneys] = useState<JourneyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadJourneys();
  }, [activeProjectId]);

  const loadJourneys = async () => {
    try {
      setLoading(true);
      if (!activeProjectId) {
        setJourneys([]);
        setError(t("journeys.selectProject"));
        return;
      }
      const data = await journeysApi.listJourneys({ project_id: activeProjectId });
      setJourneys(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("journeys.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <MsqdxIcon name="hourglass_empty" customSize={24} />
        <p>{t("journeys.loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem" }}>
        <div style={{ padding: "1rem", backgroundColor: "var(--color-secondary-dx-pink-tint)", borderRadius: "8px", color: "var(--color-secondary-dx-pink-on-light)" }}>
          <strong>{t("journeys.errorTitle")}</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1>{t("journeys.title")}</h1>
        <button
          className="msqdx-glass-button"
          onClick={() => {
            // TODO: Navigate to create journey
            window.location.href = "/admin/journeys/new";
          }}
        >
          <MsqdxIcon name="add" customSize={16} /> {t("journeys.create")}
        </button>
      </div>

      {journeys.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)" }}>
          <MsqdxIcon name="route" customSize={48} />
          <p>{t("journeys.empty")}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
          {journeys.map((journey) => (
            <div
              key={journey.id}
              className="msqdx-glass-card"
              onClick={() => {
                const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
                window.location.href = `${basePath}/admin/journeys/${journey.id}`;
              }}
              style={{ cursor: "pointer" }}
            >
              <h3>{journey.name}</h3>
              {journey.description && <p style={{ color: "var(--color-text-secondary)", marginTop: "0.5rem" }}>{journey.description}</p>}
              <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                <span>
                  <MsqdxIcon name="route" customSize={14} /> {t("journeys.phases", { count: journey.phases.length })}
                </span>
                <span>
                  <MsqdxIcon name="label" customSize={14} /> {t("journeys.type", { type: journey.journey_type })}
                </span>
              </div>
              {typeof journey.validation_score === "number" && (
                <div style={{ marginTop: "1rem", padding: "0.5rem", backgroundColor: "var(--color-surface)", borderRadius: "4px" }}>
                  <span style={{ fontSize: "0.875rem" }}>{t("journeys.validation")}: </span>
                  <strong>{journey.validation_score.toFixed(1)}%</strong>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

