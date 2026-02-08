"use client";

import { useRef } from "react";
import type { PersonaResponse } from "@msqdx-glass/types";
import { MsqdxIcon } from "@msqdx/react";
import { MsqdxGlassDashboardCard } from "./msqdx-glass-dashboard-card";
import { MsqdxGlassDashboardCardSection } from "./msqdx-glass-dashboard-card-section";
import { MsqdxGlassInlineEditControls } from "../msqdx-glass-inline-edit-controls";
import { useInlineEdit } from "../hooks/use-inline-edit";
import { Box } from "@mui/material";

export type EditFormState = {
  name: string;
  headline: string;
  segment: string;
  status: string;
  updatedBy: string;
};

export type MsqdxGlassPersonaBasicsCardProps = {
  detail: PersonaResponse;
  editForm: EditFormState;
  expanded: boolean;
  onToggle: (id: string) => void;
  onEditField: (field: keyof EditFormState, value: string) => void;
  onSave: (updates?: Partial<EditFormState>) => void | Promise<void>;
  onArchive?: () => void;
  onDelete?: () => void;
  savePending: boolean;
  formatDate: (value?: string | null) => string;
};

export const MsqdxGlassPersonaBasicsCard = ({
  detail,
  editForm,
  expanded,
  onToggle,
  onEditField,
  onSave,
  onArchive,
  onDelete,
  savePending,
  formatDate
}: MsqdxGlassPersonaBasicsCardProps) => {
  // Individual inline edit hooks for each field
  const nameEdit = useInlineEdit({
    initialValue: detail.profile.name,
    currentValue: detail.profile.name,
    isEqual: (a, b) => a === b
  });

  const segmentEdit = useInlineEdit({
    initialValue: detail.profile.segment,
    currentValue: detail.profile.segment,
    isEqual: (a, b) => a === b
  });

  const headlineEdit = useInlineEdit({
    initialValue: detail.profile.headline,
    currentValue: detail.profile.headline,
    isEqual: (a, b) => a === b
  });

  const statusEdit = useInlineEdit({
    initialValue: detail.metadata.status,
    currentValue: detail.metadata.status,
    isEqual: (a, b) => a === b
  });

  const updatedByEdit = useInlineEdit({
    initialValue: detail.metadata.updatedBy ?? "persona-admin-ui",
    currentValue: detail.metadata.updatedBy ?? "persona-admin-ui",
    isEqual: (a, b) => a === b
  });

  // Element refs for positioning
  const nameRef = useRef<HTMLDivElement>(null);
  const segmentRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const updatedByRef = useRef<HTMLDivElement>(null);

  const handleSaveName = async () => {
    await onSave({ name: nameEdit.getValue() });
    onEditField("name", nameEdit.getValue());
    setTimeout(() => {
      nameEdit.sync();
    }, 100);
  };

  const handleSaveSegment = async () => {
    await onSave({ segment: segmentEdit.getValue() });
    onEditField("segment", segmentEdit.getValue());
    setTimeout(() => {
      segmentEdit.sync();
    }, 100);
  };

  const handleSaveHeadline = async () => {
    await onSave({ headline: headlineEdit.getValue() });
    onEditField("headline", headlineEdit.getValue());
    setTimeout(() => {
      headlineEdit.sync();
    }, 100);
  };

  const handleSaveStatus = async () => {
    await onSave({ status: statusEdit.getValue() });
    onEditField("status", statusEdit.getValue());
    setTimeout(() => {
      statusEdit.sync();
    }, 100);
  };

  const handleSaveUpdatedBy = async () => {
    await onSave({ updatedBy: updatedByEdit.getValue() });
    onEditField("updatedBy", updatedByEdit.getValue());
    setTimeout(() => {
      updatedByEdit.sync();
    }, 100);
  };

  return (
    <MsqdxGlassDashboardCard
      id="persona-basics"
      title="Persona Basics"
      icon="info"
      variant="persona-basics"
      iconColor={{
        color: "var(--color-theme-accent)"
      }}
      borderColor="var(--color-theme-accent)"
      fullWidth={true}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="msqdx-glass-detail__grid">
        <div style={{ border: "1px solid var(--color-theme-accent)", borderRadius: "12px", padding: "0.75rem", marginTop: "1rem" }}>
          <h3 style={{ fontSize: "1.5rem", fontWeight: 100, marginBottom: "2rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>METADATA</h3>
          <dl className="msqdx-glass-meta-grid">
            <div>
              <dt>Status</dt>
              <dd>{detail.metadata.status}</dd>
            </div>
            <div style={{ borderLeft: "1px solid var(--color-theme-accent)", paddingLeft: "0.75rem" }}>
              <dt>Confidence</dt>
              <dd>{detail.metadata.confidence.toFixed(2)}</dd>
            </div>
            <div style={{ borderLeft: "1px solid var(--color-theme-accent)", paddingLeft: "0.75rem" }}>
              <dt>Version</dt>
              <dd>{detail.metadata.version}</dd>
            </div>
            <div style={{ borderLeft: "1px solid var(--color-theme-accent)", paddingLeft: "0.75rem" }}>
              <dt>Updated</dt>
              <dd>{formatDate(detail.metadata.updatedAt)}</dd>
            </div>
            <div style={{ borderLeft: "1px solid var(--color-theme-accent)", paddingLeft: "0.75rem" }}>
              <dt>Updated by</dt>
              <dd>{detail.metadata.updatedBy ?? "—"}</dd>
            </div>
            <div style={{ borderLeft: "1px solid var(--color-theme-accent)", paddingLeft: "0.75rem" }}>
              <dt>Last review</dt>
              <dd>{formatDate(detail.metadata.lastReviewedAt)}</dd>
            </div>
            {detail.profile.created_at && (
              <div style={{ borderLeft: "1px solid var(--color-theme-accent)", paddingLeft: "0.75rem" }}>
                <dt>Created at</dt>
                <dd>{formatDate(detail.profile.created_at)}</dd>
              </div>
            )}
            {detail.profile.targetGroupId && (
              <div style={{ borderLeft: "1px solid var(--color-theme-accent)", paddingLeft: "0.75rem" }}>
                <dt>Target Group</dt>
                <dd>
                  <a 
                    href={`/target-groups/admin?selected=${detail.profile.targetGroupId}`}
                    className="msqdx-glass-button --ghost"
                    style={{ fontSize: "0.875rem", padding: "4px 8px" }}
                  >
                    <MsqdxIcon name="groups" customSize={14} /> To Target Group
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <MsqdxGlassDashboardCardSection title="Edit">
          <Box ref={nameRef} sx={{ position: "relative", marginTop: "0.5rem" }}>
            <div className="msqdx-glass-field">
              <label>Name</label>
              <input 
                value={nameEdit.value} 
                onChange={(event) => nameEdit.setValue(event.target.value)} 
              />
            </div>
            <MsqdxGlassInlineEditControls
              hasChanges={nameEdit.hasChanges}
              saving={savePending}
              onSave={handleSaveName}
              onDiscard={() => nameEdit.reset()}
              anchorElement={nameRef.current}
              position="top"
            />
          </Box>

          <Box ref={segmentRef} sx={{ position: "relative" }}>
            <div className="msqdx-glass-field">
              <label>Segment</label>
              <input 
                value={segmentEdit.value} 
                onChange={(event) => segmentEdit.setValue(event.target.value)} 
              />
            </div>
            <MsqdxGlassInlineEditControls
              hasChanges={segmentEdit.hasChanges}
              saving={savePending}
              onSave={handleSaveSegment}
              onDiscard={() => segmentEdit.reset()}
              anchorElement={segmentRef.current}
              position="top"
            />
          </Box>

          <Box ref={headlineRef} sx={{ position: "relative" }}>
            <div className="msqdx-glass-field">
              <label>Headline</label>
              <input 
                value={headlineEdit.value} 
                onChange={(event) => headlineEdit.setValue(event.target.value)} 
              />
            </div>
            <MsqdxGlassInlineEditControls
              hasChanges={headlineEdit.hasChanges}
              saving={savePending}
              onSave={handleSaveHeadline}
              onDiscard={() => headlineEdit.reset()}
              anchorElement={headlineRef.current}
              position="top"
            />
          </Box>

          <Box ref={statusRef} sx={{ position: "relative" }}>
            <div className="msqdx-glass-field">
              <label>Status</label>
              <select 
                value={statusEdit.value} 
                onChange={(event) => statusEdit.setValue(event.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <MsqdxGlassInlineEditControls
              hasChanges={statusEdit.hasChanges}
              saving={savePending}
              onSave={handleSaveStatus}
              onDiscard={() => statusEdit.reset()}
              anchorElement={statusRef.current}
              position="top"
            />
          </Box>

          <Box ref={updatedByRef} sx={{ position: "relative" }}>
            <div className="msqdx-glass-field">
              <label>Updated by</label>
              <input 
                value={updatedByEdit.value} 
                onChange={(event) => updatedByEdit.setValue(event.target.value)} 
              />
            </div>
            <MsqdxGlassInlineEditControls
              hasChanges={updatedByEdit.hasChanges}
              saving={savePending}
              onSave={handleSaveUpdatedBy}
              onDiscard={() => updatedByEdit.reset()}
              anchorElement={updatedByRef.current}
              position="top"
            />
          </Box>

          <div className="msqdx-glass-detail__actions" style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
            {onArchive && (
              <button 
                className="msqdx-glass-button --ghost" 
                onClick={onArchive}
                disabled={savePending}
              >
                <MsqdxIcon name="archive" customSize={18} /> Archive
              </button>
            )}
            {onDelete && (
              <button 
                className="msqdx-glass-button --ghost" 
                onClick={onDelete}
                disabled={savePending}
                title="Delete persona"
                style={{ padding: "0.375rem", fontSize: "0.75rem", color: "var(--color-secondary-dx-pink)" }}
              >
                <MsqdxIcon name="delete" customSize={16} />
              </button>
            )}
          </div>
        </MsqdxGlassDashboardCardSection>
      </div>
    </MsqdxGlassDashboardCard>
  );
};
