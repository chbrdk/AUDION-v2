"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { journeysApi, type JourneyResponse, type InsightResponse, type MeasurementResponse } from "../../../../api/_lib/journeys";
import { MaterialSymbol } from "../../../../../components/material-symbol";

export default function JourneyDashboardPage() {
  const params = useParams();
  const journeyId = params.journeyId as string;
  const [journey, setJourney] = useState<JourneyResponse | null>(null);
  const [insights, setInsights] = useState<InsightResponse[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (journeyId) {
      loadData();
    }
  }, [journeyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [journeyData, insightsData, measurementsData] = await Promise.all([
        journeysApi.getJourney(journeyId),
        journeysApi.getInsights(journeyId).catch(() => []),
        journeysApi.getMeasurements(journeyId).catch(() => []),
      ]);
      setJourney(journeyData);
      setInsights(insightsData);
      setMeasurements(measurementsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncMeasurements = async () => {
    try {
      await journeysApi.syncMeasurements(journeyId);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to sync measurements");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <MaterialSymbol icon="hourglass_empty" fontSize={24} />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error || !journey) {
    return (
      <div style={{ padding: "2rem" }}>
        <div style={{ padding: "1rem", backgroundColor: "var(--color-secondary-dx-pink-tint)", borderRadius: "8px", color: "var(--color-secondary-dx-pink-on-light)" }}>
          <strong>Error:</strong> {error || "Journey not found"}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1>{journey.name} - Dashboard</h1>
          <p style={{ color: "var(--color-text-secondary)", marginTop: "0.5rem" }}>Measurements and Insights</p>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button className="udg-glass-button --ghost" onClick={handleSyncMeasurements}>
            <MaterialSymbol icon="sync" fontSize={16} /> Sync Measurements
          </button>
          <button
            className="udg-glass-button --ghost"
            onClick={() => {
              window.location.href = `/admin/journeys/${journeyId}`;
            }}
          >
            <MaterialSymbol icon="arrow_back" fontSize={16} /> Back to Editor
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
        <div className="udg-glass-card">
          <h2>Recent Insights</h2>
          {insights.length === 0 ? (
            <p style={{ color: "var(--color-text-secondary)", padding: "1rem" }}>No insights yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {insights.slice(0, 5).map((insight) => (
                <div key={insight.id} style={{ padding: "1rem", backgroundColor: "var(--color-surface)", borderRadius: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
                    <strong>{insight.title}</strong>
                    <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>{insight.insight_type}</span>
                  </div>
                  {insight.description && <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>{insight.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="udg-glass-card">
          <h2>Measurements</h2>
          {measurements.length === 0 ? (
            <p style={{ color: "var(--color-text-secondary)", padding: "1rem" }}>No measurements yet. Sync to load data.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {measurements.slice(0, 5).map((measurement) => (
                <div key={measurement.id} style={{ padding: "1rem", backgroundColor: "var(--color-surface)", borderRadius: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <strong>Value:</strong> {measurement.actual_value}
                      {typeof measurement.delta_percent === "number" && (
                        <span style={{ marginLeft: "1rem", color: measurement.delta_percent > 0 ? "green" : "red" }}>
                          ({measurement.delta_percent > 0 ? "+" : ""}{measurement.delta_percent.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        padding: "0.25rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.875rem",
                        backgroundColor:
                          measurement.status === "good"
                            ? "var(--color-success)"
                            : measurement.status === "warning"
                              ? "var(--color-warning)"
                              : "var(--color-error)",
                      }}
                    >
                      {measurement.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

