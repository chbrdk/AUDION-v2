"use client";

import type { PersonaResponse } from "@udg-glass/types";
import { MaterialSymbol } from "../material-symbol";
import { UdgGlassDashboardCard } from "./udg-glass-dashboard-card";
import { UdgGlassDashboardCardSection } from "./udg-glass-dashboard-card-section";

export type EditFormState = {
  name: string;
  headline: string;
  segment: string;
  status: string;
  updatedBy: string;
};

export type UdgGlassPersonaBasicsCardProps = {
  detail: PersonaResponse;
  editForm: EditFormState;
  expanded: boolean;
  onToggle: (id: string) => void;
  onEditField: (field: keyof EditFormState, value: string) => void;
  onSave: () => void;
  onArchive?: () => void;
  savePending: boolean;
  formatDate: (value?: string | null) => string;
};

export const UdgGlassPersonaBasicsCard = ({
  detail,
  editForm,
  expanded,
  onToggle,
  onEditField,
  onSave,
  onArchive,
  savePending,
  formatDate
}: UdgGlassPersonaBasicsCardProps) => {
  return (
    <UdgGlassDashboardCard
      id="persona-basics"
      title="Persona-Grundlagen"
      icon="info"
      variant="persona-basics"
      iconColor={{
        color: "var(--color-secondary-dx-purple)"
      }}
      borderColor="var(--color-secondary-dx-purple)"
      fullWidth={true}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="udg-glass-detail__grid">
        <UdgGlassDashboardCardSection title="Metadaten">
          <dl className="udg-glass-meta-grid" style={{ marginTop: "0.5rem" }}>
            <div>
              <dt>Status</dt>
              <dd>{detail.metadata.status}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{detail.metadata.confidence.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{detail.metadata.version}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDate(detail.metadata.updatedAt)}</dd>
            </div>
            <div>
              <dt>Updated by</dt>
              <dd>{detail.metadata.updatedBy ?? "—"}</dd>
            </div>
            <div>
              <dt>Last review</dt>
              <dd>{formatDate(detail.metadata.lastReviewedAt)}</dd>
            </div>
            {detail.profile.created_at && (
              <div>
                <dt>Erstellt am</dt>
                <dd>{formatDate(detail.profile.created_at)}</dd>
              </div>
            )}
            {detail.profile.targetGroupId && (
              <div>
                <dt>Target Group</dt>
                <dd>
                  <a 
                    href={`/target-groups/admin?selected=${detail.profile.targetGroupId}`}
                    className="udg-glass-button --ghost"
                    style={{ fontSize: "0.875rem", padding: "4px 8px" }}
                  >
                    <MaterialSymbol icon="groups" fontSize={14} /> Zur Target Group
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </UdgGlassDashboardCardSection>

        <UdgGlassDashboardCardSection title="Bearbeiten">
          <div className="udg-glass-field" style={{ marginTop: "0.5rem" }}>
            <label>Name</label>
            <input 
              value={editForm.name} 
              onChange={(event) => onEditField("name", event.target.value)} 
            />
          </div>
          <div className="udg-glass-field">
            <label>Segment</label>
            <input 
              value={editForm.segment} 
              onChange={(event) => onEditField("segment", event.target.value)} 
            />
          </div>
          <div className="udg-glass-field">
            <label>Headline</label>
            <input 
              value={editForm.headline} 
              onChange={(event) => onEditField("headline", event.target.value)} 
            />
          </div>
          <div className="udg-glass-field">
            <label>Status</label>
            <select 
              value={editForm.status} 
              onChange={(event) => onEditField("status", event.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="udg-glass-field">
            <label>Updated by</label>
            <input 
              value={editForm.updatedBy} 
              onChange={(event) => onEditField("updatedBy", event.target.value)} 
            />
          </div>
          <div className="udg-glass-detail__actions" style={{ marginTop: "1rem" }}>
            <button 
              className="udg-glass-button" 
              onClick={onSave} 
              disabled={savePending}
            >
              <MaterialSymbol icon="save" fontSize={18} /> 
              {savePending ? "Speichere..." : "Speichern"}
            </button>
            {onArchive && (
              <button 
                className="udg-glass-button --ghost" 
                onClick={onArchive}
                disabled={savePending}
              >
                <MaterialSymbol icon="archive" fontSize={18} /> Archivieren
              </button>
            )}
          </div>
        </UdgGlassDashboardCardSection>
      </div>
    </UdgGlassDashboardCard>
  );
};

