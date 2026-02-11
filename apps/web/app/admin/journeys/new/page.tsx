"use client";

// Disable static generation to prevent prerendering issues with useState/useContext
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { journeysApi, type JourneyCreate, type JourneyGenerateRequest } from "../../../api/_lib/journeys";
import { targetGroupsApi, type TargetGroupResponse } from "../../../api/_lib/target-groups";
import { MsqdxIcon } from "@msqdx/react";
import { useProject } from "../../../../components/projects/project-provider";
import { useI18n } from "../../../../components/i18n/i18n-provider";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function NewJourneyPage() {
  const router = useRouter();
  const { activeProjectId } = useProject();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetGroups, setTargetGroups] = useState<TargetGroupResponse[]>([]);
  const [loadingTargetGroups, setLoadingTargetGroups] = useState(true);
  const [formData, setFormData] = useState<JourneyCreate>({
    name: "",
    description: "",
    journey_type: "customer_acquisition",
    creation_mode: "manual",
    organization_id: generateUUID(), // Auto-generate organization ID
    target_group_id: "",
  });

  const loadTargetGroups = useCallback(async () => {
    try {
      setLoadingTargetGroups(true);
      if (!activeProjectId) {
        setTargetGroups([]);
        return;
      }
      const response = await targetGroupsApi.listTargetGroups({ page_size: 100, project_id: activeProjectId });
      setTargetGroups(response.items || []);
    } catch (err) {
      console.error("Failed to load target groups:", err);
      setError(`${t("journeys.new.errors.loadTargetGroupsFailed")}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingTargetGroups(false);
    }
  }, [activeProjectId, t]);

  useEffect(() => {
    loadTargetGroups();
  }, [activeProjectId, loadTargetGroups]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.name) {
        throw new Error(t("journeys.new.errors.journeyNameRequired"));
      }
      if (!formData.organization_id || formData.organization_id.trim() === "") {
        throw new Error(t("journeys.new.errors.orgIdRequired"));
      }
      if (!activeProjectId) {
        throw new Error(t("journeys.new.errors.projectRequired"));
      }

      // Validate UUID format (basic check)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(formData.organization_id.trim())) {
        throw new Error(t("journeys.new.errors.orgIdInvalidUuid"));
      }
      if (formData.target_group_id && formData.target_group_id.trim() !== "" && !uuidRegex.test(formData.target_group_id.trim())) {
        throw new Error(t("journeys.new.errors.targetGroupInvalidUuid"));
      }
      // Clean up empty strings to undefined
      const cleanedData: JourneyCreate = {
        ...formData,
        organization_id: formData.organization_id.trim(),
        target_group_id: formData.target_group_id?.trim() || undefined,
        project_id: activeProjectId,
        description: formData.description?.trim() || undefined,
      };

      const journey = await journeysApi.createJourney(cleanedData);
      router.push(`/admin/journeys/${journey.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("journeys.new.errors.createFailed"));
      setLoading(false);
    }
  };

  const handleGenerateWithAI = async () => {
    setGenerating(true);
    setError(null);

    try {
      // Validate required fields for AI generation
      if (!formData.target_group_id || formData.target_group_id.trim() === "") {
        throw new Error(t("journeys.new.errors.targetGroupRequired"));
      }
      if (!formData.organization_id || formData.organization_id.trim() === "") {
        throw new Error(t("journeys.new.errors.orgIdRequired"));
      }
      if (!formData.journey_type) {
        throw new Error(t("journeys.new.errors.journeyTypeRequired"));
      }
      if (!activeProjectId) {
        throw new Error(t("journeys.new.errors.projectRequired"));
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(formData.organization_id.trim())) {
        throw new Error(t("journeys.new.errors.orgIdInvalidUuid"));
      }
      if (!uuidRegex.test(formData.target_group_id.trim())) {
        throw new Error(t("journeys.new.errors.targetGroupInvalidUuid"));
      }
      const generateRequest: JourneyGenerateRequest = {
        target_group_id: formData.target_group_id.trim(),
        journey_type: formData.journey_type,
        organization_id: formData.organization_id.trim(),
        project_id: activeProjectId,
        created_by: undefined, // Could be set from user context
        use_async: false, // Use synchronous generation for now
      };

      const journey = await journeysApi.generateJourney(generateRequest);
      router.push(`/admin/journeys/${journey.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("journeys.new.errors.generateFailed"));
      setGenerating(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1>{t("journeys.new.title")}</h1>
        <button
          className="msqdx-glass-button --ghost"
          onClick={() => router.push("/admin/journeys")}
          disabled={loading}
        >
          <MsqdxIcon name="arrow_back" customSize={16} /> {t("journeys.new.cancel")}
        </button>
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "var(--color-secondary-dx-pink-tint)", borderRadius: "8px", color: "var(--color-secondary-dx-pink-on-light)", marginBottom: "2rem" }}>
          <strong>{t("journeys.new.errorTitle")}</strong> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="msqdx-glass-card" style={{ padding: "2rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div>
            <label htmlFor="name" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
              {t("journeys.new.journeyName")}
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "4px",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
                color: "var(--color-text-primary)",
              }}
            />
          </div>

          <div>
            <label htmlFor="description" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
              {t("journeys.new.description")}
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={loading}
              rows={4}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "4px",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
                color: "var(--color-text-primary)",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div>
            <label htmlFor="journey_type" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
              {t("journeys.new.journeyType")}
            </label>
            <select
              id="journey_type"
              value={formData.journey_type}
              onChange={(e) => setFormData({ ...formData, journey_type: e.target.value })}
              required
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "4px",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
                color: "var(--color-text-primary)",
              }}
            >
              <option value="customer_acquisition">{t("journeys.new.journeyTypes.customer_acquisition")}</option>
              <option value="customer_onboarding">{t("journeys.new.journeyTypes.customer_onboarding")}</option>
              <option value="customer_retention">{t("journeys.new.journeyTypes.customer_retention")}</option>
              <option value="customer_support">{t("journeys.new.journeyTypes.customer_support")}</option>
              <option value="product_usage">{t("journeys.new.journeyTypes.product_usage")}</option>
              <option value="purchase_decision">{t("journeys.new.journeyTypes.purchase_decision")}</option>
            </select>
          </div>

          <div>
            <label htmlFor="creation_mode" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
              {t("journeys.new.creationMode")}
            </label>
            <select
              id="creation_mode"
              value={formData.creation_mode}
              onChange={(e) => setFormData({ ...formData, creation_mode: e.target.value as "manual" | "ai_generated" | "hybrid" })}
              required
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "4px",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
                color: "var(--color-text-primary)",
              }}
            >
              <option value="manual">{t("journeys.new.creationModes.manual")}</option>
              <option value="ai_generated">{t("journeys.new.creationModes.ai_generated")}</option>
              <option value="hybrid">{t("journeys.new.creationModes.hybrid")}</option>
            </select>
          </div>

          <div>
            <label htmlFor="organization_id" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
              {t("journeys.new.organizationId")}
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                id="organization_id"
                type="text"
                value={formData.organization_id}
                onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
                required
                disabled={loading}
                placeholder={t("journeys.new.organizationPlaceholder")}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  borderRadius: "4px",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface)",
                  color: "var(--color-text-primary)",
                }}
              />
              <button
                type="button"
                className="msqdx-glass-button --ghost"
                onClick={() => setFormData({ ...formData, organization_id: generateUUID() })}
                disabled={loading}
                title={t("journeys.new.generateOrgIdTitle")}
                style={{ whiteSpace: "nowrap" }}
              >
                <MsqdxIcon name="refresh" customSize={16} /> {t("journeys.new.generateOrgId")}
              </button>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginTop: "0.25rem" }}>
              {t("journeys.new.orgIdHint")}
            </p>
          </div>

          <div>
            <label htmlFor="target_group_id" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
              {t("journeys.new.targetGroup")}
            </label>
            <select
              id="target_group_id"
              value={formData.target_group_id}
              onChange={(e) => setFormData({ ...formData, target_group_id: e.target.value })}
              disabled={loading || loadingTargetGroups}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "4px",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
                color: "var(--color-text-primary)",
              }}
            >
              <option value="">{t("journeys.new.selectTargetGroup")}</option>
              {targetGroups.map((tg) => (
                <option key={tg.id} value={tg.id}>
                  {tg.name} {tg.description ? `- ${tg.description}` : ""}
                </option>
              ))}
            </select>
            {loadingTargetGroups && (
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginTop: "0.25rem" }}>
                {t("journeys.new.loadingTargetGroups")}
              </p>
            )}
            {!loadingTargetGroups && targetGroups.length === 0 && (
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginTop: "0.25rem" }}>
                {t("journeys.new.noTargetGroups")}
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginTop: "1rem" }}>
            <button
              type="button"
              className="msqdx-glass-button --ghost"
              onClick={() => router.push("/admin/journeys")}
              disabled={loading || generating}
            >
              {t("journeys.new.cancel")}
            </button>
            {formData.target_group_id && formData.target_group_id.trim() !== "" && (
              <button
                type="button"
                className="msqdx-glass-button"
                onClick={handleGenerateWithAI}
                disabled={loading || generating || loadingTargetGroups || !activeProjectId}
                style={{ backgroundColor: "var(--color-theme-accent)", color: "white" }}
              >
                {generating ? (
                  <>
                    <MsqdxIcon name="hourglass_empty" customSize={16} /> {t("journeys.new.generating")}
                  </>
                ) : (
                  <>
                    <MsqdxIcon name="auto_awesome" customSize={16} /> {t("journeys.new.generateWithAi")}
                  </>
                )}
              </button>
            )}
            <button
              type="submit"
              className="msqdx-glass-button"
              disabled={loading || generating || !activeProjectId}
            >
              {loading ? (
                <>
                  <MsqdxIcon name="hourglass_empty" customSize={16} /> {t("journeys.new.creating")}
                </>
              ) : (
                <>
                  <MsqdxIcon name="add" customSize={16} /> {t("journeys.new.createJourney")}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
