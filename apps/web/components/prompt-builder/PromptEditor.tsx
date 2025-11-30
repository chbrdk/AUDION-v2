"use client";

import { useRef, useState } from "react";

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function PromptEditor({ value, onChange, placeholder = "Enter your prompt here..." }: PromptEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const variableSyntax = e.dataTransfer.getData("text/variable-syntax");
    if (!variableSyntax || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const newValue = textarea.value.substring(0, start) + variableSyntax + textarea.value.substring(end);
    onChange(newValue);

    // Restore cursor position after state update
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = start + variableSyntax.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  // Highlight variables in the textarea (simple approach)
  const highlightVariables = (text: string): string => {
    // This is a simple approach - for more advanced highlighting, consider using a library
    // For now, we'll just render the text as-is and use CSS for basic styling
    return text;
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        placeholder={placeholder}
        style={{
          width: "100%",
          height: "100%",
          minHeight: "400px",
          padding: "1rem",
          border: isDraggingOver ? "2px dashed var(--color-theme-accent)" : "1px solid rgba(148, 163, 184, 0.3)",
          borderRadius: "8px",
          fontFamily: "monospace",
          fontSize: "0.875rem",
          lineHeight: "1.6",
          background: isDraggingOver ? "rgba(182, 56, 255, 0.05)" : "var(--color-neutral)",
          resize: "vertical",
          transition: "all 0.2s ease",
        }}
      />
      {isDraggingOver && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            padding: "1rem 2rem",
            background: "var(--color-theme-accent)",
            color: "white",
            borderRadius: "8px",
            fontSize: "0.875rem",
            fontWeight: 600,
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          Drop variable here
        </div>
      )}
    </div>
  );
}

