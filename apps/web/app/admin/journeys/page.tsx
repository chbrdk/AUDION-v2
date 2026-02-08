"use client";

// Disable static generation to prevent prerendering issues with useState/useContext
export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { journeysApi, type JourneyResponse } from "../../api/_lib/journeys";
import { MsqdxIcon } from "@msqdx/react";

export default function JourneysListPage() {
  const [journeys, setJourneys] = useState<JourneyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadJourneys();
  }, []);

  const loadJourneys = async () => {
    try {
      setLoading(true);
      const data = await journeysApi.listJourneys();
      setJourneys(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load journeys");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <MsqdxIcon name="hourglass_empty" customSize={24} />
        <p>Loading journeys...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem" }}>
        <div style={{ padding: "1rem", backgroundColor: "var(--color-secondary-dx-pink-tint)", borderRadius: "8px", color: "var(--color-secondary-dx-pink-on-light)" }}>
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1>Journeys</h1>
        <button
          className="msqdx-glass-button"
          onClick={() => {
            // TODO: Navigate to create journey
            window.location.href = "/admin/journeys/new";
          }}
        >
          <MsqdxIcon name="add" customSize={16} /> Create Journey
        </button>
      </div>

      {journeys.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)" }}>
          <MsqdxIcon name="route" customSize={48} />
          <p>No journeys yet. Create your first journey to get started.</p>
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
                  <MsqdxIcon name="route" customSize={14} /> {journey.phases.length} phases
                </span>
                <span>
                  <MsqdxIcon name="label" customSize={14} /> {journey.journey_type}
                </span>
              </div>
              {typeof journey.validation_score === "number" && (
                <div style={{ marginTop: "1rem", padding: "0.5rem", backgroundColor: "var(--color-surface)", borderRadius: "4px" }}>
                  <span style={{ fontSize: "0.875rem" }}>Validation Score: </span>
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



