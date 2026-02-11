"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { VariablePalette } from "./VariablePalette";
import { PromptEditor } from "./PromptEditor";
import { LivePreviewPanel } from "./LivePreviewPanel";
import { ExecutionOutputPanel } from "./ExecutionOutputPanel";
import { VariableContextPanel } from "./VariableContextPanel";
import { ResizablePanel } from "./ResizablePanel";
import { MsqdxIcon } from "@msqdx/react";
import { aiAssistApi, type AiAssistResponse } from "../../app/api/_lib/ai-assist";
import { generateMockContext } from "./mockData";

interface PromptBuilderProps {
  initialPrompt: string;
  onPromptChange: (prompt: string) => void;
}

export function PromptBuilder({ initialPrompt, onPromptChange }: PromptBuilderProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [context, setContext] = useState<Record<string, string>>({});
  const [useMockData, setUseMockData] = useState(true);
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AiAssistResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [enrichedContext, setEnrichedContext] = useState<Record<string, any>>({});

  // Update prompt when initialPrompt changes externally
  useEffect(() => {
    if (initialPrompt !== prompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  const handlePromptChange = (newPrompt: string) => {
    setPrompt(newPrompt);
    onPromptChange(newPrompt);
  };

  const handleContextChange = (newContext: Record<string, string>) => {
    setContext(newContext);
    // Auto-switch to real data if any IDs are provided
    const hasRealIds = Object.values(newContext).some((v) => v && v.trim() !== "");
    if (hasRealIds) {
      setUseMockData(false);
    }
  };

  // Determine required context variables from extended variables in prompt
  const requiredVars = useMemo(() => {
    const required: string[] = [];
    const extendedVarPattern = /\$\{([a-z_]+):\$\{([^}]+)\}([^}]*)\}/g;
    let match;
    while ((match = extendedVarPattern.exec(prompt)) !== null) {
      const idVar = match[2];
      if (!required.includes(idVar)) {
        required.push(idVar);
      }
    }
    return required;
  }, [prompt]);

  // Enrich context for testing (similar to LivePreviewPanel)
  useEffect(() => {
    // This will be handled by LivePreviewPanel, but we need it here too for testing
    const mockContext = generateMockContext();
    const effectiveContext = useMockData || Object.keys(context).length === 0
      ? { ...mockContext, ...context }
      : context;
    setEnrichedContext(effectiveContext);
  }, [context, useMockData]);

  const handleTestPrompt = useCallback(async () => {
    if (!prompt.trim()) {
      return;
    }

    setTesting(true);
    setTestError(null);
    setTestResult(null);

    try {
      const mockContext = generateMockContext();
      const effectiveContext = useMockData || Object.keys(enrichedContext).length === 0
        ? { ...mockContext, ...enrichedContext }
        : enrichedContext;

      const response = await aiAssistApi.testPrompt({
        prompt: prompt,
        context: effectiveContext,
        temperature: 0.6,
        max_tokens: 1024,
      });

      setTestResult(response);
    } catch (error) {
      console.error("Test failed:", error);
      setTestError(error instanceof Error ? error.message : "Failed to test prompt");
    } finally {
      setTesting(false);
    }
  }, [prompt, enrichedContext, useMockData]);

  const canTest = !testing && prompt.trim().length > 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: "600px",
        background: "var(--color-neutral)",
        borderRadius: "12px",
        border: "1px solid rgba(148, 163, 184, 0.2)",
        overflow: "hidden",
      }}
    >
      {/* Header with mode toggle */}
      <div
        style={{
          padding: "1rem",
          borderBottom: "1px solid rgba(148, 163, 184, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--color-neutral)",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Interactive Prompt Builder
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={useMockData}
              onChange={(e) => setUseMockData(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            <span>Use Mock Data</span>
          </label>
        </div>
      </div>

      {/* Main content area - three columns */}
      <div style={{ display: "flex", flex: 1, overflow: "visible" }}>
        {/* Left: Variable Palette */}
        <ResizablePanel initialWidth={280} minWidth={200} maxWidth={500} side="right">
          <VariablePalette />
        </ResizablePanel>

        {/* Center: Editor / Preview with Tabs */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Tab Navigation */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(148, 163, 184, 0.2)", background: "var(--color-neutral)" }}>
            <button
              onClick={() => setActiveTab("editor")}
              style={{
                flex: 1,
                padding: "0.75rem 1rem",
                background: activeTab === "editor" ? "var(--color-neutral)" : "transparent",
                border: "none",
                borderBottom: activeTab === "editor" ? "2px solid var(--color-theme-accent)" : "2px solid transparent",
                color: activeTab === "editor" ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                fontSize: "0.8125rem",
                fontWeight: activeTab === "editor" ? 600 : 400,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                transition: "all 0.2s ease",
              }}
            >
              <MsqdxIcon name="edit" customSize={18} />
              <span>Editor</span>
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              style={{
                flex: 1,
                padding: "0.75rem 1rem",
                background: activeTab === "preview" ? "var(--color-neutral)" : "transparent",
                border: "none",
                borderBottom: activeTab === "preview" ? "2px solid var(--color-theme-accent)" : "2px solid transparent",
                color: activeTab === "preview" ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                fontSize: "0.8125rem",
                fontWeight: activeTab === "preview" ? 600 : 400,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                transition: "all 0.2s ease",
              }}
            >
              <MsqdxIcon name="visibility" customSize={18} />
              <span>Live Preview</span>
            </button>
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {activeTab === "editor" ? (
              <>
                <div style={{ padding: "1rem", borderBottom: "1px solid rgba(148, 163, 184, 0.2)" }}>
                  <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.8125rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Prompt Editor
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
                    Drag variables from the palette or type directly. Drop variables into the editor to insert them.
                  </p>
                </div>
                <div style={{ flex: 1, padding: "1rem", overflow: "auto" }}>
                  <PromptEditor value={prompt} onChange={handlePromptChange} />
                </div>
              </>
            ) : (
              <LivePreviewPanel
                prompt={prompt}
                context={context}
                useMockData={useMockData}
                onTestPrompt={handleTestPrompt}
                canTest={canTest}
                showButton={false}
              />
            )}
          </div>
        </div>

        {/* Right: Context Panel + Test Button + Execution Output */}
        <ResizablePanel initialWidth={400} minWidth={300} maxWidth={800} side="left">
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            {/* Context Panel at top */}
            <div style={{ flexShrink: 0 }}>
              <VariableContextPanel context={context} onChange={handleContextChange} requiredVars={requiredVars} />
            </div>
            {/* Test Button */}
            <div style={{ padding: "1rem", borderTop: "1px solid rgba(148, 163, 184, 0.2)", background: "var(--color-neutral)" }}>
              <button
                onClick={handleTestPrompt}
                disabled={!canTest}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  background: !canTest ? "rgba(148, 163, 184, 0.3)" : "var(--color-theme-accent)",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: !canTest ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  transition: "background 0.2s ease",
                  opacity: !canTest ? 0.6 : 1,
                }}
              >
                {testing ? (
                  <>
                    <MsqdxIcon name="hourglass_empty" customSize={18} />
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <MsqdxIcon name="play_arrow" customSize={18} />
                    <span>Test Prompt with AI</span>
                  </>
                )}
              </button>
            </div>
            {/* Execution Output below */}
            <div style={{ flex: 1, overflow: "hidden", borderTop: "1px solid rgba(148, 163, 184, 0.2)" }}>
              <ExecutionOutputPanel
                testResult={testResult}
                testError={testError}
                testing={testing}
                onClear={() => {
                  setTestResult(null);
                  setTestError(null);
                }}
              />
            </div>
          </div>
        </ResizablePanel>
      </div>
    </div>
  );
}

