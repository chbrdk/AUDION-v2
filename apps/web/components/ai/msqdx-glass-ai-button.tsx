"use client";

import { useState } from "react";

import { MaterialSymbol } from "../material-symbol";

type TemplateOption = {
  id: string;
  label: string;
  description?: string;
  maxSuggestions?: number;
};

type Props = {
  templates: TemplateOption[];
  selectedTemplateId?: string;
  onSelectTemplate?: (templateId: string) => void;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  size?: "small" | "medium";
  title?: string;
};

export const MsqdxGlassAiButton = ({
  templates,
  selectedTemplateId,
  onSelectTemplate,
  onClick,
  loading = false,
  disabled = false,
  size = "medium",
  title = "AI Assist",
}: Props) => {
  const [internalTemplate, setInternalTemplate] = useState(templates[0]?.id);
  const activeTemplateId = selectedTemplateId ?? internalTemplate;
  const handleTemplateChange = (value: string) => {
    setInternalTemplate(value);
    onSelectTemplate?.(value);
  };

  const showTemplatePicker = templates.length > 1;

  return (
    <div className="msqdx-glass-ai-button">
      {showTemplatePicker && (
        <select
          value={activeTemplateId}
          onChange={(event) => handleTemplateChange(event.target.value)}
          className="msqdx-glass-ai-button__select"
          disabled={disabled || loading}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        className={`msqdx-glass-button --ghost msqdx-glass-ai-button__trigger --${size}`}
        onClick={onClick}
        disabled={disabled || loading}
        title={title}
      >
        <MaterialSymbol icon="auto_awesome" fontSize={size === "small" ? 14 : 16} />
        <span>{loading ? "Generating..." : title}</span>
      </button>
    </div>
  );
};


