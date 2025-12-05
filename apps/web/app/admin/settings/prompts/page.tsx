"use client";

import { useState, useEffect, useMemo } from "react";
import { aiAssistApi, type AiTemplateSummary, type AiTemplateDefinition, type AiTemplateUpdateRequest } from "../../../api/_lib/ai-assist";
import { MaterialSymbol } from "../../../../components/material-symbol";
import { PromptBuilder } from "../../../../components/prompt-builder/PromptBuilder";
import clsx from "clsx";

export default function SettingsPromptsPage() {
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

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        await Promise.all([loadTemplates(), loadPersonaPrompts()]);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await aiAssistApi.listTemplates();
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    }
  };

  const loadPersonaPrompts = async () => {
    try {
      const data = await aiAssistApi.listPersonaPrompts();
      setPersonaPrompts(data);
    } catch (err) {
      console.error("Failed to load persona prompts:", err);
      // Don't set error for persona prompts, just log it
    }
  };

  const startEditing = async (templateId: string) => {
    try {
      let full: AiTemplateDefinition;
      
      // Check if it's a persona prompt
      if (templateId.startsWith("persona-prompt-")) {
        const personaId = templateId.replace("persona-prompt-", "");
        full = await aiAssistApi.getPersonaPrompt(personaId);
      } else {
        full = await aiAssistApi.getTemplate(templateId);
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
      setError(err instanceof Error ? err.message : "Failed to load template");
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
        await aiAssistApi.updateTemplate(editingId, updates);
        await loadTemplates();
      }
      
      cancelEditing();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
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

  if (loading) {
    return (
      <div className="udg-glass-panel">
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <MaterialSymbol icon="hourglass_empty" fontSize={24} />
          <p className="udg-glass-muted">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="udg-glass-panel">
      <header className="udg-glass-detail__header">
        <div>
          <p className="udg-glass-eyebrow">AI Settings</p>
          <h1 style={{ margin: 0 }}>Prompt Templates</h1>
          <p className="udg-glass-muted" style={{ maxWidth: "640px" }}>
            Every AI assisted feature references a reviewed template stored in the backend catalog. Edit templates directly here to update prompts and configurations.
          </p>
        </div>
      </header>

      {error && (
        <div className="udg-glass-error" style={{ margin: "1rem 0", padding: "0.75rem", borderRadius: "8px" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ margin: "2rem 0", border: "1px solid rgba(148, 163, 184, 0.3)", borderRadius: "12px", overflow: "hidden" }}>
        <button
          type="button"
          onClick={() => setShowGlossary(!showGlossary)}
          style={{
            width: "100%",
            padding: "1rem",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            textAlign: "left",
          }}
        >
          <div>
            <h3 style={{ margin: 0, marginBottom: "0.25rem" }}>Prompt Variables Glossary</h3>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
              Available variables you can use in your prompts with ${`{variable_name}`} syntax
            </p>
          </div>
          <MaterialSymbol icon={showGlossary ? "expand_less" : "expand_more"} fontSize={24} />
        </button>
        {showGlossary && (
          <div style={{ padding: "1.5rem", borderTop: "1px solid rgba(148, 163, 184, 0.3)" }}>
            <div style={{ display: "grid", gap: "2rem" }}>
              {/* Extended Variable Syntax Section */}
              <div style={{ padding: "1.25rem", background: "rgba(34, 197, 94, 0.08)", borderRadius: "12px", border: "2px solid rgba(34, 197, 94, 0.25)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                  <MaterialSymbol icon="auto_awesome" fontSize={20} style={{ color: "rgba(34, 197, 94, 1)" }} />
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
                      <MaterialSymbol icon="info" fontSize={18} style={{ color: "rgba(234, 179, 8, 1)", flexShrink: 0, marginTop: "0.125rem" }} />
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
                  <VariableItem name="persona_pain_points" description="Existing pain points of the persona" example="Lack of time, budget constraints..." />
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
        )}
      </div>

      {/* Search and Filter Bar - Global for all prompts */}
      {(personaPrompts.length > 0 || templates.length > 0) && (
        <div
          style={{
            marginTop: "2rem",
            marginBottom: "1.5rem",
            padding: "1rem",
            background: "var(--color-neutral)",
            borderRadius: "12px",
            border: "1px solid rgba(148, 163, 184, 0.2)",
          }}
        >
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {/* Search Input */}
                <div style={{ position: "relative" }}>
                  <MaterialSymbol
                    icon="search"
                    fontSize={18}
                    style={{
                      position: "absolute",
                      left: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--color-text-secondary)",
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search prompts by name, description, tags, or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.75rem 0.625rem 2.5rem",
                      border: "1px solid rgba(148, 163, 184, 0.2)",
                      borderRadius: "8px",
                      fontSize: "0.875rem",
                      background: "transparent",
                      color: "var(--color-text-primary)",
                      transition: "border-color 0.2s ease",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "var(--color-theme-accent)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "rgba(148, 163, 184, 0.2)";
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      style={{
                        position: "absolute",
                        right: "0.75rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: "0.25rem",
                        display: "flex",
                        alignItems: "center",
                        color: "var(--color-text-secondary)",
                      }}
                      title="Clear search"
                    >
                      <MaterialSymbol icon="close" fontSize={16} />
                    </button>
                  )}
                </div>

                {/* Filters Row */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
                  {/* Category Filter */}
                  {allCategories.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", fontWeight: 500 }}>
                        Category:
                      </span>
                      <select
                        value={selectedCategory || ""}
                        onChange={(e) => setSelectedCategory(e.target.value || null)}
                        style={{
                          padding: "0.375rem 0.75rem",
                          border: "1px solid rgba(148, 163, 184, 0.2)",
                          borderRadius: "6px",
                          fontSize: "0.8125rem",
                          background: "transparent",
                          color: "var(--color-text-primary)",
                          cursor: "pointer",
                        }}
                      >
                        <option value="">All Categories</option>
                        {allCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Tags Filter */}
                  {allTags.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", fontWeight: 500 }}>
                        Tags:
                      </span>
                      {allTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={clsx(
                            "udg-glass-chip",
                            selectedTags.has(tag) && "--active"
                          )}
                          style={{
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            background: selectedTags.has(tag)
                              ? "var(--color-theme-accent)"
                              : "rgba(148, 163, 184, 0.1)",
                            color: selectedTags.has(tag)
                              ? "white"
                              : "var(--color-text-primary)",
                            border: selectedTags.has(tag)
                              ? "1px solid var(--color-theme-accent)"
                              : "1px solid rgba(148, 163, 184, 0.2)",
                            fontSize: "0.75rem",
                            fontWeight: 400,
                            padding: "0.25rem 0.5rem",
                          }}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Clear Filters Button */}
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      style={{
                        marginLeft: "auto",
                        padding: "0.375rem 0.75rem",
                        background: "transparent",
                        border: "1px solid rgba(148, 163, 184, 0.2)",
                        borderRadius: "6px",
                        fontSize: "0.8125rem",
                        color: "var(--color-text-secondary)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--color-theme-accent)";
                        e.currentTarget.style.color = "var(--color-theme-accent)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.2)";
                        e.currentTarget.style.color = "var(--color-text-secondary)";
                      }}
                    >
                      <MaterialSymbol icon="filter_alt_off" fontSize={14} />
                      Clear Filters
                    </button>
                  )}
                </div>

                {/* Results Count - Combined */}
                {hasActiveFilters && (
                  <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                    Showing {filteredPersonaPrompts.length} persona prompt{filteredPersonaPrompts.length !== 1 ? "s" : ""}
                    {templates.length > 0 && (
                      <> and {filteredTemplates.length} template{filteredTemplates.length !== 1 ? "s" : ""}</>
                    )}
                  </div>
                )}
              </div>
        </div>
      )}

      <div className="udg-glass-settings-grid">
        {/* Persona Prompts Section */}
        {personaPrompts.length > 0 && (
          <>
            <div style={{ gridColumn: "1 / -1", marginTop: "2rem", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>Persona Prompts</h2>
              <p className="udg-glass-muted" style={{ marginTop: "0.5rem" }}>
                System prompts used for persona chat interactions. These are dynamically generated and can be customized.
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
                <MaterialSymbol icon="search_off" fontSize={48} style={{ marginBottom: "1rem", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: "1rem", fontWeight: 500 }}>No persona prompts found</p>
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>
                  {hasActiveFilters
                    ? "Try adjusting your filters or search query."
                    : "No persona prompts are available yet."}
                </p>
              </div>
            ) : (
              filteredPersonaPrompts.map((template) => (
              <article
                key={template.template_id}
                className={clsx("udg-glass-settings-card", editingId === template.template_id && "--expanded")}
              >
                {editingId === template.template_id && editingTemplate ? (
                  <>
                    {/* Tab Navigation */}
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", borderBottom: "1px solid rgba(148, 163, 184, 0.2)" }}>
                      <button
                        type="button"
                        onClick={() => setActiveTab("edit")}
                        style={{
                          padding: "0.5rem 1rem",
                          background: activeTab === "edit" ? "var(--color-theme-accent)" : "transparent",
                          color: activeTab === "edit" ? "white" : "var(--color-text-primary)",
                          border: "none",
                          borderBottom: activeTab === "edit" ? "2px solid var(--color-theme-accent)" : "2px solid transparent",
                          cursor: "pointer",
                          fontSize: "0.8125rem",
                          fontWeight: activeTab === "edit" ? 600 : 400,
                          transition: "all 0.2s ease",
                        }}
                      >
                        <MaterialSymbol icon="edit" fontSize={16} style={{ marginRight: "0.25rem", verticalAlign: "middle" }} />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("test")}
                        style={{
                          padding: "0.5rem 1rem",
                          background: activeTab === "test" ? "var(--color-theme-accent)" : "transparent",
                          color: activeTab === "test" ? "white" : "var(--color-text-primary)",
                          border: "none",
                          borderBottom: activeTab === "test" ? "2px solid var(--color-theme-accent)" : "2px solid transparent",
                          cursor: "pointer",
                          fontSize: "0.8125rem",
                          fontWeight: activeTab === "test" ? 600 : 400,
                          transition: "all 0.2s ease",
                        }}
                      >
                        <MaterialSymbol icon="science" fontSize={16} style={{ marginRight: "0.25rem", verticalAlign: "middle" }} />
                        Test & Preview
                      </button>
                    </div>

                    {/* Tab Content */}
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
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
                      <div style={{ flex: 1 }}>
                        <p className="udg-glass-eyebrow" style={{ marginBottom: "0.25rem" }}>
                          {template.category}
                        </p>
                        <h3 style={{ marginBottom: "0.5rem" }}>{template.label}</h3>
                      </div>
                      <button
                        className="udg-glass-button --ghost"
                        onClick={() => startEditing(template.template_id)}
                        style={{ padding: "0.25rem 0.5rem" }}
                        title="Edit template"
                      >
                        <MaterialSymbol icon="edit" fontSize={16} />
                      </button>
                    </div>
                    <p className="udg-glass-muted" style={{ minHeight: "48px" }}>
                      {template.description}
                    </p>
                    <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                      <span className="udg-glass-badge --outline">{template.default_provider}</span>
                      {template.default_model && <span className="udg-glass-chip --dashboard">{template.default_model}</span>}
                    </div>
                    {template.tags.length > 0 && (
                      <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                        {template.tags.map((tag) => (
                          <span key={tag} className="udg-glass-chip --dashboard --tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </article>
              ))
            )}
          </>
        )}

        {/* Regular Templates Section */}
        {templates.length > 0 && (
          <>
            {personaPrompts.length > 0 && (
              <div style={{ gridColumn: "1 / -1", marginTop: "2rem", marginBottom: "1rem" }}>
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>AI Templates</h2>
                <p className="udg-glass-muted" style={{ marginTop: "0.5rem" }}>
                  Standard templates for AI-assisted features like journey mapping and phase generation.
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
                <MaterialSymbol icon="search_off" fontSize={48} style={{ marginBottom: "1rem", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: "1rem", fontWeight: 500 }}>No templates found</p>
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>
                  {hasActiveFilters
                    ? "Try adjusting your filters or search query."
                    : "No templates are available yet."}
                </p>
              </div>
            ) : (
              filteredTemplates.map((template) => (
          <article
            key={template.template_id}
            className={clsx("udg-glass-settings-card", editingId === template.template_id && "--expanded")}
          >
            {editingId === template.template_id && editingTemplate ? (
              <>
                {/* Tab Navigation */}
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", borderBottom: "1px solid rgba(148, 163, 184, 0.2)" }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab("edit")}
                    style={{
                      padding: "0.5rem 1rem",
                      background: activeTab === "edit" ? "var(--color-theme-accent)" : "transparent",
                      color: activeTab === "edit" ? "white" : "var(--color-text-primary)",
                      border: "none",
                      borderBottom: activeTab === "edit" ? "2px solid var(--color-theme-accent)" : "2px solid transparent",
                      cursor: "pointer",
                      fontSize: "0.8125rem",
                      fontWeight: activeTab === "edit" ? 600 : 400,
                      transition: "all 0.2s ease",
                    }}
                  >
                    <MaterialSymbol icon="edit" fontSize={16} style={{ marginRight: "0.25rem", verticalAlign: "middle" }} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("test")}
                    style={{
                      padding: "0.5rem 1rem",
                      background: activeTab === "test" ? "var(--color-theme-accent)" : "transparent",
                      color: activeTab === "test" ? "white" : "var(--color-text-primary)",
                      border: "none",
                      borderBottom: activeTab === "test" ? "2px solid var(--color-theme-accent)" : "2px solid transparent",
                      cursor: "pointer",
                      fontSize: "0.8125rem",
                      fontWeight: activeTab === "test" ? 600 : 400,
                      transition: "all 0.2s ease",
                    }}
                  >
                    <MaterialSymbol icon="science" fontSize={16} style={{ marginRight: "0.25rem", verticalAlign: "middle" }} />
                    Test & Preview
                  </button>
                </div>

                {/* Tab Content */}
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
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
                  <div style={{ flex: 1 }}>
                    <p className="udg-glass-eyebrow" style={{ marginBottom: "0.25rem" }}>
                      {template.category}
                    </p>
                    <h3 style={{ marginBottom: "0.5rem" }}>{template.label}</h3>
                  </div>
                  <button
                    className="udg-glass-button --ghost"
                    onClick={() => startEditing(template.template_id)}
                    style={{ padding: "0.25rem 0.5rem" }}
                    title="Edit template"
                  >
                    <MaterialSymbol icon="edit" fontSize={16} />
                  </button>
                </div>
                <p className="udg-glass-muted" style={{ minHeight: "48px" }}>
                  {template.description}
                </p>
                <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                  <span className="udg-glass-badge --outline">{template.default_provider}</span>
                  {template.default_model && <span className="udg-glass-chip --dashboard">{template.default_model}</span>}
                </div>
                {template.tags.length > 0 && (
                  <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                    {template.tags.map((tag) => (
                      <span key={tag} className="udg-glass-chip --dashboard --tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </article>
              ))
            )}
          </>
        )}
      </div>
    </div>
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
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div>
        <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
          Label
        </label>
        <input
          type="text"
          value={template.label}
          onChange={(e) => onUpdate({ ...template, label: e.target.value })}
          style={{ width: "100%", padding: "0.5rem", border: "1px solid var(--color-theme-accent)", borderRadius: "4px" }}
          required
        />
      </div>

      <div>
        <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
          Description
        </label>
        <textarea
          value={template.description}
          onChange={(e) => onUpdate({ ...template, description: e.target.value })}
          rows={2}
          style={{ width: "100%", padding: "0.5rem", border: "1px solid var(--color-theme-accent)", borderRadius: "4px", fontFamily: "inherit" }}
          required
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
            Category
          </label>
          <input
            type="text"
            value={template.category}
            onChange={(e) => onUpdate({ ...template, category: e.target.value })}
            style={{ width: "100%", padding: "0.5rem", border: "1px solid var(--color-theme-accent)", borderRadius: "4px" }}
            required
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
            Provider
          </label>
          <select
            value={template.default_provider}
            onChange={(e) => onUpdate({ ...template, default_provider: e.target.value as "anthropic" | "openai" })}
            style={{ width: "100%", padding: "0.5rem", border: "1px solid var(--color-theme-accent)", borderRadius: "4px" }}
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
            Temperature
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="1"
            value={template.temperature}
            onChange={(e) => onUpdate({ ...template, temperature: parseFloat(e.target.value) })}
            style={{ width: "100%", padding: "0.5rem", border: "1px solid var(--color-theme-accent)", borderRadius: "4px" }}
            required
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
            Max Tokens
          </label>
          <input
            type="number"
            min="64"
            value={template.max_tokens}
            onChange={(e) => onUpdate({ ...template, max_tokens: parseInt(e.target.value) })}
            style={{ width: "100%", padding: "0.5rem", border: "1px solid var(--color-theme-accent)", borderRadius: "4px" }}
            required
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
            Model
          </label>
          <input
            type="text"
            value={template.default_model || ""}
            onChange={(e) => onUpdate({ ...template, default_model: e.target.value || undefined })}
            placeholder="claude-3-5-sonnet-20241022"
            style={{ width: "100%", padding: "0.5rem", border: "1px solid var(--color-theme-accent)", borderRadius: "4px" }}
          />
        </div>
      </div>

      <div>
        <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
          Tags (comma-separated)
        </label>
        <input
          type="text"
          value={template.tags.join(", ")}
          onChange={(e) => onUpdate({ ...template, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
          placeholder="journey, phase, moments"
          style={{ width: "100%", padding: "0.5rem", border: "1px solid var(--color-theme-accent)", borderRadius: "4px" }}
        />
      </div>

      <div>
        <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem", fontWeight: 500 }}>
          Prompt <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>(use ${`{variable}`} for interpolation)</span>
        </label>
        <textarea
          value={template.prompt}
          onChange={(e) => onUpdate({ ...template, prompt: e.target.value })}
          rows={12}
          style={{
            width: "100%",
            padding: "0.5rem",
            border: "1px solid var(--color-theme-accent)",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "0.875rem",
            lineHeight: "1.5",
          }}
          required
        />
      </div>

      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
        <button type="button" className="udg-glass-button --ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="udg-glass-button" disabled={saving}>
          {saving ? (
            <>
              <MaterialSymbol icon="hourglass_empty" fontSize={14} /> Saving...
            </>
          ) : (
            <>
              <MaterialSymbol icon="save" fontSize={14} /> Save
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function VariableItem({ name, description, example }: { name: string; description: string; example?: string }) {
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
              Example: {example}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
