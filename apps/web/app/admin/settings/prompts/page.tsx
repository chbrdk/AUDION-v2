"use client";

// Disable static generation to prevent prerendering issues with useState/useContext
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback } from "react";
import { Box, Stack } from "@mui/material";
import {
  MsqdxIcon,
  MsqdxButton,
  MsqdxMoleculeCard,
  MsqdxFormField,
  MsqdxSelect,
  MsqdxTypography,
  MsqdxSearchField,
  MsqdxTextareaField,
  MsqdxAccordion,
  MsqdxAccordionItem,
  MsqdxChip,
  MsqdxTabs,
} from "@msqdx/react";
import nextDynamic from "next/dynamic";
import { aiAssistApi, type AiTemplateSummary, type AiTemplateDefinition, type AiTemplateUpdateRequest } from "../../../api/_lib/ai-assist";
import { useProject } from "../../../../components/projects/project-provider";
import { useI18n } from "../../../../components/i18n/i18n-provider";

// Code Splitting: PromptBuilder ist eine große Komponente
const PromptBuilderLoader = () => {
  const { t } = useI18n();
  return <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>{t("prompts.loadingBuilder")}</MsqdxTypography>;
};

const PromptBuilder = nextDynamic(
  () => import("../../../../components/prompt-builder/PromptBuilder").then((mod) => ({ default: mod.PromptBuilder })),
  {
    loading: () => <PromptBuilderLoader />,
    ssr: false, // PromptBuilder benötigt Client-Side Features
  }
);

export default function SettingsPromptsPage() {
  const { activeProjectId } = useProject();
  const { t } = useI18n();
  const [templates, setTemplates] = useState<AiTemplateSummary[]>([]);
  const [personaPrompts, setPersonaPrompts] = useState<AiTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<AiTemplateDefinition | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGlossary, setShowGlossary] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "test">("edit");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const loadTemplates = useCallback(async (projectId: string) => {
    try {
      const data = await aiAssistApi.listTemplates(projectId);
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("prompts.errors.loadTemplates"));
    }
  }, [t]);

  const loadPersonaPrompts = useCallback(async () => {
    try {
      const data = await aiAssistApi.listPersonaPrompts();
      setPersonaPrompts(data);
    } catch (err) {
      console.error("Failed to load persona prompts:", err);
      // Don't set error for persona prompts, just log it
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      if (!activeProjectId) {
        setTemplates([]);
        setPersonaPrompts([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        await Promise.all([loadTemplates(activeProjectId), loadPersonaPrompts()]);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [activeProjectId, loadTemplates, loadPersonaPrompts]);





  const startEditing = async (templateId: string) => {
    try {
      let full: AiTemplateDefinition;

      // Check if it's a persona prompt
      if (templateId.startsWith("persona-prompt-")) {
        const personaId = templateId.replace("persona-prompt-", "");
        full = await aiAssistApi.getPersonaPrompt(personaId);
      } else {
        full = await aiAssistApi.getTemplate(templateId, activeProjectId ?? undefined);
      }

      setEditingTemplate(full);
      setError(null);
      setActiveTab("edit"); // Reset to edit tab when opening a new template
      // Use requestAnimationFrame to ensure transition is visible
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setEditingId(templateId);
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("prompts.errors.loadTemplate"));
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingTemplate(null);
    setError(null);
  };

  const saveTemplate = async () => {
    if (!editingTemplate || !editingId) return;

    try {
      setSaving(true);
      setError(null);
      const updates: AiTemplateUpdateRequest = {
        label: editingTemplate.label,
        description: editingTemplate.description,
        category: editingTemplate.category,
        tags: editingTemplate.tags,
        default_provider: editingTemplate.default_provider,
        default_model: editingTemplate.default_model,
        temperature: editingTemplate.temperature,
        max_tokens: editingTemplate.max_tokens,
        prompt: editingTemplate.prompt,
        output: editingTemplate.output,
        metadata: editingTemplate.metadata,
      };

      // Check if it's a persona prompt
      if (editingId.startsWith("persona-prompt-")) {
        const personaId = editingId.replace("persona-prompt-", "");
        await aiAssistApi.updatePersonaPrompt(personaId, updates);
        await loadPersonaPrompts();
      } else {
        await aiAssistApi.updateTemplate(editingId, updates, activeProjectId ?? undefined);
        if (activeProjectId) {
          await loadTemplates(activeProjectId);
        }
      }

      cancelEditing();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("prompts.errors.saveTemplate"));
    } finally {
      setSaving(false);
    }
  };

  // Extract unique categories and tags from all templates
  const allCategories = useMemo(() => {
    const categories = new Set<string>();
    templates.forEach((t) => categories.add(t.category));
    personaPrompts.forEach((t) => categories.add(t.category));
    return Array.from(categories).sort();
  }, [templates, personaPrompts]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    templates.forEach((t) => t.tags.forEach((tag) => tags.add(tag)));
    personaPrompts.forEach((t) => t.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort();
  }, [templates, personaPrompts]);

  // Filter function for templates
  const matchesFilter = (template: AiTemplateSummary): boolean => {
    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        template.label.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.category.toLowerCase().includes(query) ||
        template.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        (template as any).persona_name?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Category filter
    if (selectedCategory && template.category !== selectedCategory) {
      return false;
    }

    // Tags filter (at least one selected tag must be present)
    if (selectedTags.size > 0) {
      const hasSelectedTag = Array.from(selectedTags).some((tag) =>
        template.tags.includes(tag)
      );
      if (!hasSelectedTag) return false;
    }

    return true;
  };

  // Filtered templates
  const filteredPersonaPrompts = useMemo(
    () => personaPrompts.filter(matchesFilter),
    [personaPrompts, searchQuery, selectedCategory, selectedTags]
  );

  const filteredTemplates = useMemo(
    () => templates.filter(matchesFilter),
    [templates, searchQuery, selectedCategory, selectedTags]
  );

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory(null);
    setSelectedTags(new Set());
  };

  const hasActiveFilters = searchQuery.trim() || selectedCategory || selectedTags.size > 0;
  const personaResults =
    filteredPersonaPrompts.length === 1
      ? t("prompts.results.personaOne")
      : t("prompts.results.personaMany", { count: filteredPersonaPrompts.length });
  const templateResults =
    filteredTemplates.length === 1
      ? t("prompts.results.templateOne")
      : t("prompts.results.templateMany", { count: filteredTemplates.length });

  if (!activeProjectId) {
    return (
      <Box sx={{ p: 3 }}>
        <MsqdxTypography variant="h2" component="h2">{t("prompts.title")}</MsqdxTypography>
        <MsqdxTypography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t("prompts.selectProject")}
        </MsqdxTypography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Stack alignItems="center" gap={1} sx={{ p: 3 }}>
        <MsqdxIcon name="hourglass_empty" customSize={24} />
        <MsqdxTypography variant="body2" color="text.secondary">{t("prompts.loading")}</MsqdxTypography>
      </Stack>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box>
        <MsqdxTypography variant="overline" color="text.secondary">{t("prompts.eyebrow")}</MsqdxTypography>
        <MsqdxTypography variant="h1" component="h1" sx={{ mt: 0, mb: 0.5 }}>{t("prompts.title")}</MsqdxTypography>
        <MsqdxTypography variant="body2" color="text.secondary" sx={{ maxWidth: 640 }}>
          {t("prompts.subtitle")}
        </MsqdxTypography>
      </Box>

      {error && (
        <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: "error.light", color: "error.contrastText" }}>
          <MsqdxTypography variant="body2"><strong>{t("prompts.errorTitle")}</strong> {error}</MsqdxTypography>
        </Box>
      )}

      <MsqdxAccordion
        expanded={showGlossary ? ["glossary"] : []}
        onChange={(ids) => setShowGlossary(ids.includes("glossary"))}
        allowMultiple={false}
        sx={{ my: 2 }}
      >
        <MsqdxAccordionItem
          id="glossary"
          summary={
            <Box>
              <MsqdxTypography variant="h3" component="span" sx={{ display: "block", mb: 0.25 }}>{t("prompts.glossary.title")}</MsqdxTypography>
              <MsqdxTypography variant="body2" color="text.secondary" component="span">{t("prompts.glossary.subtitle", { variable: "${variable_name}" })}</MsqdxTypography>
            </Box>
          }
        >
          <div style={{ padding: "1.5rem", borderTop: "1px solid rgba(148, 163, 184, 0.3)" }}>
            <div style={{ display: "grid", gap: "2rem" }}>
              {/* Extended Variable Syntax Section */}
              <div style={{ padding: "1.25rem", background: "rgba(34, 197, 94, 0.08)", borderRadius: "12px", border: "2px solid rgba(34, 197, 94, 0.25)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                  <MsqdxIcon name="auto_awesome" customSize={20} style={{ color: "rgba(34, 197, 94, 1)" }} />
                  <h4 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(34, 197, 94, 1)" }}>
                    Extended Variable Syntax
                  </h4>
                </div>
                <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "var(--color-text-secondary)", lineHeight: "1.6" }}>
                  Access database entities directly using extended variable syntax. This allows you to reference specific personas, journeys, target groups, or phases without pre-loading all data into context.
                </p>

                <div style={{ marginBottom: "1.25rem", padding: "0.75rem", background: "rgba(15, 23, 42, 0.05)", borderRadius: "8px", border: "1px solid rgba(148, 163, 184, 0.2)" }}>
                  <p style={{ margin: "0 0 0.5rem", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-primary)" }}>Syntax Pattern:</p>
                  <code style={{
                    background: "rgba(15, 23, 42, 0.1)",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    fontFamily: "monospace",
                    display: "block",
                    whiteSpace: "pre-wrap",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                    color: "var(--color-theme-accent)",
                    fontWeight: 600
                  }}>
                    {"$" + "{resolver_type:$" + "{id_variable}.property.path}"}
                  </code>
                </div>

                <div style={{ display: "grid", gap: "1.25rem" }}>
                  <div>
                    <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)" }}>Supported Resolver Types:</p>
                    <div style={{ display: "grid", gap: "0.5rem" }}>
                      <div style={{ padding: "0.625rem", background: "rgba(15, 23, 42, 0.03)", borderRadius: "6px", border: "1px solid rgba(148, 163, 184, 0.15)" }}>
                        <code style={{ background: "rgba(182, 56, 255, 0.15)", padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-theme-accent)", fontFamily: "monospace" }}>persona</code>
                        <span style={{ marginLeft: "0.5rem", fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>Access persona properties (name, profile, traits, goals, etc.)</span>
                      </div>
                      <div style={{ padding: "0.625rem", background: "rgba(15, 23, 42, 0.03)", borderRadius: "6px", border: "1px solid rgba(148, 163, 184, 0.15)" }}>
                        <code style={{ background: "rgba(182, 56, 255, 0.15)", padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-theme-accent)", fontFamily: "monospace" }}>journey</code>
                        <span style={{ marginLeft: "0.5rem", fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>Access journey properties (name, type, phases, etc.)</span>
                      </div>
                      <div style={{ padding: "0.625rem", background: "rgba(15, 23, 42, 0.03)", borderRadius: "6px", border: "1px solid rgba(148, 163, 184, 0.15)" }}>
                        <code style={{ background: "rgba(182, 56, 255, 0.15)", padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-theme-accent)", fontFamily: "monospace" }}>target_group</code>
                        <span style={{ marginLeft: "0.5rem", fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>Access target group properties (name, segment, personas, etc.)</span>
                      </div>
                      <div style={{ padding: "0.625rem", background: "rgba(15, 23, 42, 0.03)", borderRadius: "6px", border: "1px solid rgba(148, 163, 184, 0.15)" }}>
                        <code style={{ background: "rgba(182, 56, 255, 0.15)", padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-theme-accent)", fontFamily: "monospace" }}>phase</code>
                        <span style={{ marginLeft: "0.5rem", fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>Access journey phase properties (name, description, emotion, etc.)</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)" }}>Property Path Examples:</p>
                    <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.8125rem" }}>
                      <div style={{ padding: "0.625rem", background: "rgba(15, 23, 42, 0.03)", borderRadius: "6px", border: "1px solid rgba(148, 163, 184, 0.15)" }}>
                        <code style={{ color: "var(--color-theme-accent)", fontFamily: "monospace", fontWeight: 600 }}>.name</code>
                        <span style={{ marginLeft: "0.5rem", color: "var(--color-text-secondary)" }}>Simple property access</span>
                      </div>
                      <div style={{ padding: "0.625rem", background: "rgba(15, 23, 42, 0.03)", borderRadius: "6px", border: "1px solid rgba(148, 163, 184, 0.15)" }}>
                        <code style={{ color: "var(--color-theme-accent)", fontFamily: "monospace", fontWeight: 600 }}>.profile.traits</code>
                        <span style={{ marginLeft: "0.5rem", color: "var(--color-text-secondary)" }}>Nested property with dot notation</span>
                      </div>
                      <div style={{ padding: "0.625rem", background: "rgba(15, 23, 42, 0.03)", borderRadius: "6px", border: "1px solid rgba(148, 163, 184, 0.15)" }}>
                        <code style={{ color: "var(--color-theme-accent)", fontFamily: "monospace", fontWeight: 600 }}>.phases[0].name</code>
                        <span style={{ marginLeft: "0.5rem", color: "var(--color-text-secondary)" }}>Array index access (first item)</span>
                      </div>
                      <div style={{ padding: "0.625rem", background: "rgba(15, 23, 42, 0.03)", borderRadius: "6px", border: "1px solid rgba(148, 163, 184, 0.15)" }}>
                        <code style={{ color: "var(--color-theme-accent)", fontFamily: "monospace", fontWeight: 600 }}>.phases[*].name</code>
                        <span style={{ marginLeft: "0.5rem", color: "var(--color-text-secondary)" }}>Array wildcard (all items, joined with newlines)</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)" }}>Practical Examples:</p>
                    <div style={{ display: "grid", gap: "0.75rem" }}>
                      <div style={{ padding: "0.875rem", background: "rgba(15, 23, 42, 0.05)", borderRadius: "8px", border: "1px solid rgba(148, 163, 184, 0.2)" }}>
                        <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)" }}>Basic Persona Access</p>
                        <code style={{
                          background: "rgba(182, 56, 255, 0.15)",
                          padding: "0.375rem 0.625rem",
                          borderRadius: "6px",
                          fontSize: "0.8125rem",
                          fontFamily: "monospace",
                          display: "block",
                          marginBottom: "0.375rem",
                          color: "var(--color-theme-accent)",
                          fontWeight: 600
                        }}>
                          {`\${persona:\${persona_id}.name}`}
                        </code>
                        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-secondary)", lineHeight: "1.5" }}>
                          Get persona name using <code style={{ background: "rgba(15, 23, 42, 0.1)", padding: "0.125rem 0.25rem", borderRadius: "3px", fontSize: "0.7rem" }}>persona_id</code> from context
                        </p>
                      </div>

                      <div style={{ padding: "0.875rem", background: "rgba(15, 23, 42, 0.05)", borderRadius: "8px", border: "1px solid rgba(148, 163, 184, 0.2)" }}>
                        <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)" }}>Nested Property</p>
                        <code style={{
                          background: "rgba(182, 56, 255, 0.15)",
                          padding: "0.375rem 0.625rem",
                          borderRadius: "6px",
                          fontSize: "0.8125rem",
                          fontFamily: "monospace",
                          display: "block",
                          marginBottom: "0.375rem",
                          color: "var(--color-theme-accent)",
                          fontWeight: 600
                        }}>
                          {`\${persona:\${persona_id}.profile.traits}`}
                        </code>
                        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-secondary)", lineHeight: "1.5" }}>
                          Access persona profile traits using dot notation
                        </p>
                      </div>

                      <div style={{ padding: "0.875rem", background: "rgba(15, 23, 42, 0.05)", borderRadius: "8px", border: "1px solid rgba(148, 163, 184, 0.2)" }}>
                        <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)" }}>Array Index Access</p>
                        <code style={{
                          background: "rgba(182, 56, 255, 0.15)",
                          padding: "0.375rem 0.625rem",
                          borderRadius: "6px",
                          fontSize: "0.8125rem",
                          fontFamily: "monospace",
                          display: "block",
                          marginBottom: "0.375rem",
                          color: "var(--color-theme-accent)",
                          fontWeight: 600
                        }}>
                          {`\${journey:\${journey_id}.phases[0].name}`}
                        </code>
                        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-secondary)", lineHeight: "1.5" }}>
                          Get name of the first journey phase (index 0)
                        </p>
                      </div>

                      <div style={{ padding: "0.875rem", background: "rgba(15, 23, 42, 0.05)", borderRadius: "8px", border: "1px solid rgba(148, 163, 184, 0.2)" }}>
                        <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)" }}>Array Wildcard</p>
                        <code style={{
                          background: "rgba(182, 56, 255, 0.15)",
                          padding: "0.375rem 0.625rem",
                          borderRadius: "6px",
                          fontSize: "0.8125rem",
                          fontFamily: "monospace",
                          display: "block",
                          marginBottom: "0.375rem",
                          color: "var(--color-theme-accent)",
                          fontWeight: 600
                        }}>
                          {`\${journey:\${journey_id}.phases[*].name}`}
                        </code>
                        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-secondary)", lineHeight: "1.5" }}>
                          Get all phase names (returns newline-separated list)
                        </p>
                      </div>

                      <div style={{ padding: "0.875rem", background: "rgba(15, 23, 42, 0.05)", borderRadius: "8px", border: "1px solid rgba(148, 163, 184, 0.2)" }}>
                        <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)" }}>Complex Nested Access</p>
                        <code style={{
                          background: "rgba(182, 56, 255, 0.15)",
                          padding: "0.375rem 0.625rem",
                          borderRadius: "6px",
                          fontSize: "0.8125rem",
                          fontFamily: "monospace",
                          display: "block",
                          marginBottom: "0.375rem",
                          color: "var(--color-theme-accent)",
                          fontWeight: 600
                        }}>
                          {`\${journey:\${journey_id}.phases[2].expected_emotion}`}
                        </code>
                        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-secondary)", lineHeight: "1.5" }}>
                          Get expected emotion of the third phase (index 2)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: "1rem", background: "rgba(234, 179, 8, 0.1)", borderRadius: "8px", border: "1px solid rgba(234, 179, 8, 0.3)" }}>
                    <div style={{ display: "flex", alignItems: "start", gap: "0.5rem", marginBottom: "0.75rem" }}>
                      <MsqdxIcon name="info" customSize={18} style={{ color: "rgba(234, 179, 8, 1)", flexShrink: 0, marginTop: "0.125rem" }} />
                      <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)" }}>Important Notes:</p>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "1.75rem", fontSize: "0.8125rem", color: "var(--color-text-secondary)", lineHeight: "1.6" }}>
                      <li style={{ marginBottom: "0.375rem" }}>
                        The <code style={{ background: "rgba(15, 23, 42, 0.1)", padding: "0.125rem 0.25rem", borderRadius: "3px", fontSize: "0.75rem", fontFamily: "monospace" }}>id_variable</code> must exist in your template context (e.g., <code style={{ background: "rgba(15, 23, 42, 0.1)", padding: "0.125rem 0.25rem", borderRadius: "3px", fontSize: "0.75rem", fontFamily: "monospace" }}>persona_id</code>, <code style={{ background: "rgba(15, 23, 42, 0.1)", padding: "0.125rem 0.25rem", borderRadius: "3px", fontSize: "0.75rem", fontFamily: "monospace" }}>journey_id</code>)
                      </li>
                      <li style={{ marginBottom: "0.375rem" }}>
                        Entity IDs must be valid UUIDs (format: <code style={{ background: "rgba(15, 23, 42, 0.1)", padding: "0.125rem 0.25rem", borderRadius: "3px", fontSize: "0.75rem", fontFamily: "monospace" }}>xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</code>)
                      </li>
                      <li style={{ marginBottom: "0.375rem" }}>
                        Missing entities return placeholder: <code style={{ background: "rgba(15, 23, 42, 0.1)", padding: "0.125rem 0.25rem", borderRadius: "3px", fontSize: "0.75rem", fontFamily: "monospace" }}>[Entity not found]</code>
                      </li>
                      <li style={{ marginBottom: "0.375rem" }}>
                        Missing properties return placeholder: <code style={{ background: "rgba(15, 23, 42, 0.1)", padding: "0.125rem 0.25rem", borderRadius: "3px", fontSize: "0.75rem", fontFamily: "monospace" }}>[Property not found]</code>
                      </li>
                      <li style={{ marginBottom: "0.375rem" }}>
                        Array wildcards (<code style={{ background: "rgba(15, 23, 42, 0.1)", padding: "0.125rem 0.25rem", borderRadius: "3px", fontSize: "0.75rem", fontFamily: "monospace" }}>[*]</code>) return all items joined with newlines
                      </li>
                      <li>
                        Invalid array indices return: <code style={{ background: "rgba(15, 23, 42, 0.1)", padding: "0.125rem 0.25rem", borderRadius: "3px", fontSize: "0.75rem", fontFamily: "monospace" }}>[Array index out of range]</code>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: "0.75rem", fontSize: "0.875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Journey Variables
                </h4>
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <VariableItem name="journey_name" description="Name of the journey" example="E-Bike Kauf Journey" />
                  <VariableItem name="journey_type" description="Type of the journey (e.g., purchase, support, onboarding)" example="purchase" />
                  <VariableItem name="journey_description" description="Full description of the journey" example="Complete journey from awareness to purchase" />
                  <VariableItem name="target_group_summary" description="Summary of the target group characteristics" example="Tech-savvy urban professionals, 30-45 years" />
                  <VariableItem name="persona_summaries" description="Summarized information about related personas" example="Persona 1: Tech Enthusiast, Persona 2: Eco-Conscious..." />
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: "0.75rem", fontSize: "0.875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Phase Variables
                </h4>
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <VariableItem name="phase_name" description="Name of the current phase" example="Awareness" />
                  <VariableItem name="phase_description" description="Description of the current phase" example="Customer becomes aware of the product" />
                  <VariableItem name="phase_expected_emotion" description="Expected emotion for the phase" example="hopeful, anxious, frustrated" />
                  <VariableItem name="existing_phases_summary" description="Summary of all existing phases in the journey" example="Phase 1: Awareness, Phase 2: Consideration..." />
                  <VariableItem name="existing_phases_count" description="Number of existing phases" example="3" />
                  <VariableItem name="last_phase_summary" description="Detailed summary of the last phase" example="Phase 3: Purchase - Customer completes order..." />
                  <VariableItem name="last_phase_name" description="Name of the last phase" example="Purchase" />
                  <VariableItem name="last_phase_emotion" description="Emotion of the last phase" example="satisfied" />
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: "0.75rem", fontSize: "0.875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Persona Variables
                </h4>
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <VariableItem name="persona_name" description="Name of the persona" example="Tech Enthusiast" />
                  <VariableItem name="persona_headline" description="Headline or tagline of the persona" example="Early adopter of new technologies" />
                  <VariableItem name="persona_bio" description="Full biography or description of the persona" example="Detailed persona profile with demographics, goals, challenges..." />
                  <VariableItem name="persona_profile" description="Full profile of the persona" example="Age, occupation, goals, challenges..." />
                  <VariableItem name="persona_pain_points" description="Existing pain points of the persona" example="Lack of time, bmsqdxet constraints..." />
                  <VariableItem name="existing_traits" description="List of currently defined personality traits" example="organizer, tech-savvy, detail-oriented" />
                  <VariableItem name="graph_relationships_summary" description="Formatted summary of Neo4j knowledge graph relationships connected to this persona" example="HAS_INTEREST: [technology, innovation], WORKS_WITH: [software, tools]" />
                  <VariableItem name="knowledge_context" description="Relevant research chunks from Qdrant vector database related to this persona" example="Research findings about user behavior, preferences, and characteristics..." />
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: "0.75rem", fontSize: "0.875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Control Variables
                </h4>
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <VariableItem name="max_items" description="Maximum number of items to generate" example="5" />
                  <VariableItem name="max_suggestions" description="Maximum number of suggestions to return" example="3" />
                </div>
              </div>

              <div style={{ padding: "1rem", background: "rgba(182, 56, 255, 0.1)", borderRadius: "8px", border: "1px solid rgba(182, 56, 255, 0.3)" }}>
                <p style={{ margin: 0, fontSize: "0.875rem" }}>
                  <strong>Usage:</strong> Use variables in your prompts with the syntax <code style={{ background: "rgba(15, 23, 42, 0.1)", padding: "0.125rem 0.25rem", borderRadius: "4px", fontSize: "0.8125rem" }}>{"${variable_name}"}</code>
                </p>
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>
                  Example: <code style={{ background: "rgba(15, 23, 42, 0.1)", padding: "0.125rem 0.25rem", borderRadius: "4px", fontSize: "0.8125rem" }}>Journey: {"${journey_name}"} ({"${journey_type}"})</code>
                </p>
              </div>
            </div>
          </div>
        </MsqdxAccordionItem>
      </MsqdxAccordion>

      {/* Search and Filter Bar - Global for all prompts */}
      {(personaPrompts.length > 0 || templates.length > 0) && (
        <Box sx={{ mt: 2, mb: 1.5, p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
          <Stack spacing={1.5}>
            <MsqdxSearchField
              placeholder={t("prompts.search.placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* Filters Row */}
            <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
              {allCategories.length > 0 && (
                <MsqdxSelect
                  label={t("prompts.filters.category")}
                  value={selectedCategory || ""}
                  onChange={(e) => setSelectedCategory((e.target.value as string) || null)}
                  options={[
                    { value: "", label: t("prompts.filters.allCategories") },
                    ...allCategories.map((category) => ({ value: category, label: category })),
                  ]}
                  size="small"
                />
              )}

              {allTags.length > 0 && (
                <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
                  <MsqdxTypography variant="body2" color="text.secondary">{t("prompts.filters.tags")}</MsqdxTypography>
                  {allTags.map((tag) => (
                    <MsqdxChip
                      key={tag}
                      label={tag}
                      onClick={() => toggleTag(tag)}
                      variant={selectedTags.has(tag) ? "filled" : "outlined"}
                      brandColor={selectedTags.has(tag) ? "purple" : undefined}
                      size="xs"
                    />
                  ))}
                </Stack>
              )}

              {hasActiveFilters && (
                <MsqdxButton
                  variant="outlined"
                  color="secondary"
                  size="small"
                  onClick={clearFilters}
                  startIcon={<MsqdxIcon name="filter_alt_off" customSize={14} />}
                  sx={{ ml: "auto" }}
                >
                  {t("prompts.filters.clear")}
                </MsqdxButton>
              )}
            </Stack>

            {hasActiveFilters && (
              <MsqdxTypography variant="body2" color="text.secondary">
                {t("prompts.results.showing", { persona: personaResults })}
                {templates.length > 0 && <> {t("prompts.results.and", { template: templateResults })}</>}
              </MsqdxTypography>
            )}
          </Stack>
        </Box>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2 }}>
        {/* Persona Prompts Section */}
        {personaPrompts.length > 0 && (
          <>
            <div style={{ gridColumn: "1 / -1", marginTop: "2rem", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>{t("prompts.sections.personaPrompts.title")}</h2>
              <p className="msqdx-glass-muted" style={{ marginTop: "0.5rem" }}>
                {t("prompts.sections.personaPrompts.subtitle")}
              </p>
            </div>

            {filteredPersonaPrompts.length === 0 ? (
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: "3rem 1rem",
                  textAlign: "center",
                  color: "var(--color-text-secondary)",
                }}
              >
                <MsqdxIcon name="search_off" customSize={48} style={{ marginBottom: "1rem", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: "1rem", fontWeight: 500 }}>{t("prompts.sections.personaPrompts.emptyTitle")}</p>
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>
                  {hasActiveFilters
                    ? t("prompts.sections.personaPrompts.emptyFilters")
                    : t("prompts.sections.personaPrompts.emptyNone")}
                </p>
              </div>
            ) : (
              filteredPersonaPrompts.map((template) => (
                <MsqdxMoleculeCard
                  key={template.template_id}
                  variant="flat"
                  borderRadius="button"
                  sx={{ p: 2, border: "1px solid", borderColor: editingId === template.template_id ? "primary.main" : "divider" }}
                  eyebrow={!editingId || editingId !== template.template_id ? template.category : undefined}
                  title={template.label}
                  subtitle={!editingId || editingId !== template.template_id ? template.description : undefined}
                  chips={!editingId || editingId !== template.template_id ? (
                    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                      <MsqdxChip label={template.default_provider} size="xs" variant="outlined" />
                      {template.default_model && <MsqdxChip label={template.default_model} size="xs" variant="outlined" />}
                      {template.tags.map((tag) => <MsqdxChip key={tag} label={tag} size="xs" variant="glass" />)}
                    </Stack>
                  ) : undefined}
                  headerActions={!editingId || editingId !== template.template_id ? (
                    <MsqdxButton variant="text" size="small" onClick={() => startEditing(template.template_id)} startIcon={<MsqdxIcon name="edit" customSize={16} />}>
                      {t("prompts.actions.editTemplate")}
                    </MsqdxButton>
                  ) : undefined}
                >
                  {editingId === template.template_id && editingTemplate ? (
                    <>
                      <MsqdxTabs
                        value={activeTab}
                        onChange={(v) => setActiveTab(v as "edit" | "test")}
                        tabs={[
                          { value: "edit", label: t("prompts.tabs.edit"), icon: <MsqdxIcon name="edit" customSize={16} /> },
                          { value: "test", label: t("prompts.tabs.test"), icon: <MsqdxIcon name="science" customSize={16} /> },
                        ]}
                      />

                      {activeTab === "edit" ? (
                        <TemplateEditForm
                          template={editingTemplate}
                          onUpdate={setEditingTemplate}
                          onSave={saveTemplate}
                          onCancel={cancelEditing}
                          saving={saving}
                        />
                      ) : (
                        <div style={{ minHeight: "600px" }}>
                          <PromptBuilder
                            initialPrompt={editingTemplate.prompt}
                            onPromptChange={(newPrompt) => {
                              setEditingTemplate({ ...editingTemplate, prompt: newPrompt });
                            }}
                          />
                        </div>
                      )}
                    </>
                  ) : null}
                </MsqdxMoleculeCard>
              ))
            )}
          </>
        )}

        {/* Regular Templates Section */}
        {templates.length > 0 && (
          <>
            {personaPrompts.length > 0 && (
              <div style={{ gridColumn: "1 / -1", marginTop: "2rem", marginBottom: "1rem" }}>
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>{t("prompts.sections.aiTemplates.title")}</h2>
                <p className="msqdx-glass-muted" style={{ marginTop: "0.5rem" }}>
                  {t("prompts.sections.aiTemplates.subtitle")}
                </p>
              </div>
            )}


            {filteredTemplates.length === 0 ? (
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: "3rem 1rem",
                  textAlign: "center",
                  color: "var(--color-text-secondary)",
                }}
              >
                <MsqdxIcon name="search_off" customSize={48} style={{ marginBottom: "1rem", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: "1rem", fontWeight: 500 }}>{t("prompts.sections.aiTemplates.emptyTitle")}</p>
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>
                  {hasActiveFilters
                    ? t("prompts.sections.aiTemplates.emptyFilters")
                    : t("prompts.sections.aiTemplates.emptyNone")}
                </p>
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <MsqdxMoleculeCard
                  key={template.template_id}
                  variant="flat"
                  borderRadius="button"
                  sx={{ p: 2, border: "1px solid", borderColor: editingId === template.template_id ? "primary.main" : "divider" }}
                  eyebrow={!editingId || editingId !== template.template_id ? template.category : undefined}
                  title={template.label}
                  subtitle={!editingId || editingId !== template.template_id ? template.description : undefined}
                  chips={!editingId || editingId !== template.template_id ? (
                    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                      <MsqdxChip label={template.default_provider} size="xs" variant="outlined" />
                      {template.default_model && <MsqdxChip label={template.default_model} size="xs" variant="outlined" />}
                      {template.tags.map((tag) => <MsqdxChip key={tag} label={tag} size="xs" variant="glass" />)}
                    </Stack>
                  ) : undefined}
                  headerActions={!editingId || editingId !== template.template_id ? (
                    <MsqdxButton variant="text" size="small" onClick={() => startEditing(template.template_id)} startIcon={<MsqdxIcon name="edit" customSize={16} />}>
                      {t("prompts.actions.editTemplate")}
                    </MsqdxButton>
                  ) : undefined}
                >
                  {editingId === template.template_id && editingTemplate ? (
                    <>
                      <MsqdxTabs
                        value={activeTab}
                        onChange={(v) => setActiveTab(v as "edit" | "test")}
                        tabs={[
                          { value: "edit", label: t("prompts.tabs.edit"), icon: <MsqdxIcon name="edit" customSize={16} /> },
                          { value: "test", label: t("prompts.tabs.test"), icon: <MsqdxIcon name="science" customSize={16} /> },
                        ]}
                      />
                      {activeTab === "edit" ? (
                        <TemplateEditForm
                          template={editingTemplate}
                          onUpdate={setEditingTemplate}
                          onSave={saveTemplate}
                          onCancel={cancelEditing}
                          saving={saving}
                        />
                      ) : (
                        <div style={{ minHeight: "600px" }}>
                          <PromptBuilder
                            initialPrompt={editingTemplate.prompt}
                            onPromptChange={(newPrompt) => {
                              setEditingTemplate({ ...editingTemplate, prompt: newPrompt });
                            }}
                          />
                        </div>
                      )}
                    </>
                  ) : null}
                </MsqdxMoleculeCard>
              ))
            )}
          </>
        )}
      </Box>
    </Box>
  );
}

function TemplateEditForm({
  template,
  onUpdate,
  onSave,
  onCancel,
  saving,
}: {
  template: AiTemplateDefinition;
  onUpdate: (template: AiTemplateDefinition) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const { t } = useI18n();
  return (
    <Box component="form" onSubmit={(e) => { e.preventDefault(); onSave(); }} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <MsqdxFormField
        label={t("prompts.fields.label")}
        value={template.label}
        onChange={(e) => onUpdate({ ...template, label: e.target.value })}
        required
      />
      <MsqdxTextareaField
        label={t("prompts.fields.description")}
        value={template.description}
        onChange={(e) => onUpdate({ ...template, description: e.target.value })}
        rows={2}
        required
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <MsqdxFormField
          label={t("prompts.fields.category")}
          value={template.category}
          onChange={(e) => onUpdate({ ...template, category: e.target.value })}
          required
          fullWidth
        />
        <MsqdxSelect
          label={t("prompts.fields.provider")}
          value={template.default_provider}
          onChange={(e) => onUpdate({ ...template, default_provider: (e.target as { value: string }).value as "anthropic" | "openai" })}
          options={[
            { value: "anthropic", label: "Anthropic" },
            { value: "openai", label: "OpenAI" },
          ]}
          size="small"
          fullWidth
        />
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <MsqdxFormField
          label={t("prompts.fields.temperature")}
          type="number"
          value={String(template.temperature)}
          onChange={(e) => onUpdate({ ...template, temperature: parseFloat(e.target.value) })}
          inputProps={{ step: 0.1, min: 0, max: 1 }}
          required
          fullWidth
        />
        <MsqdxFormField
          label={t("prompts.fields.maxTokens")}
          type="number"
          value={String(template.max_tokens)}
          onChange={(e) => onUpdate({ ...template, max_tokens: parseInt(e.target.value) })}
          inputProps={{ min: 64 }}
          required
          fullWidth
        />
        <MsqdxFormField
          label={t("prompts.fields.model")}
          value={template.default_model || ""}
          onChange={(e) => onUpdate({ ...template, default_model: e.target.value || undefined })}
          placeholder={t("prompts.fields.modelPlaceholder")}
          fullWidth
        />
      </Stack>
      <MsqdxFormField
        label={t("prompts.fields.tags")}
        value={template.tags.join(", ")}
        onChange={(e) => onUpdate({ ...template, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        placeholder={t("prompts.fields.tagsPlaceholder")}
      />
      <MsqdxTextareaField
        label={t("prompts.fields.prompt")}
        value={template.prompt}
        onChange={(e) => onUpdate({ ...template, prompt: e.target.value })}
        rows={12}
        required
        sx={{ "& textarea": { fontFamily: "monospace", fontSize: "0.875rem" } }}
      />
      <MsqdxTypography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
        {t("prompts.fields.promptHint", { variable: "${variable}" })}
      </MsqdxTypography>
      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 0.5 }}>
        <MsqdxButton variant="outlined" color="secondary" onClick={onCancel} disabled={saving}>
          {t("prompts.actions.cancel")}
        </MsqdxButton>
        <MsqdxButton type="submit" variant="contained" disabled={saving} startIcon={<MsqdxIcon name={saving ? "hourglass_empty" : "save"} customSize={14} />}>
          {saving ? t("prompts.actions.saving") : t("prompts.actions.save")}
        </MsqdxButton>
      </Stack>
    </Box>
  );
}

function VariableItem({ name, description, example }: { name: string; description: string; example?: string }) {
  const { t } = useI18n();
  return (
    <div style={{ padding: "0.75rem", background: "rgba(15, 23, 42, 0.03)", borderRadius: "8px", border: "1px solid rgba(148, 163, 184, 0.2)" }}>
      <div style={{ display: "flex", alignItems: "start", gap: "0.75rem" }}>
        <code
          style={{
            background: "rgba(182, 56, 255, 0.15)",
            color: "var(--color-theme-accent)",
            padding: "0.25rem 0.5rem",
            borderRadius: "6px",
            fontSize: "0.8125rem",
            fontWeight: 600,
            fontFamily: "monospace",
            whiteSpace: "nowrap",
          }}
        >
          {`\${${name}}`}
        </code>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500, color: "#0f172a" }}>{description}</p>
          {example && (
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
              {t("prompts.example")}: {example}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
