"use client";

import { MsqdxIcon } from "@msqdx/react";
import { type AiAssistResponse } from "../../app/api/_lib/ai-assist";

interface ExecutionOutputPanelProps {
  testResult: AiAssistResponse | null;
  testError: string | null;
  testing: boolean;
  onClear: () => void;
}

export function ExecutionOutputPanel({ testResult, testError, testing, onClear }: ExecutionOutputPanelProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--color-neutral)",
      }}
    >
      <div style={{ padding: "1rem", borderBottom: "1px solid rgba(148, 163, 184, 0.2)", background: "var(--color-neutral)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            AI Execution Output
          </h3>
          {(testResult || testError) && (
            <button
              onClick={onClear}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--color-text-secondary)",
                cursor: "pointer",
                padding: "0.25rem",
                display: "flex",
                alignItems: "center",
                borderRadius: "4px",
                transition: "background 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(148, 163, 184, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
              title="Clear output"
            >
              <MsqdxIcon name="close" customSize={18} />
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "1rem", position: "relative" }}>
        {testing && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "1rem",
              padding: "3rem",
              color: "var(--color-text-secondary)",
            }}
          >
            <MsqdxIcon name="hourglass_empty" customSize={48} style={{ opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500 }}>Executing prompt with AI...</p>
            <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.7 }}>This may take a few moments</p>
          </div>
        )}

        {!testing && !testResult && !testError && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "3rem",
              color: "var(--color-text-secondary)",
              textAlign: "center",
            }}
          >
            <MsqdxIcon name="play_arrow" customSize={32} style={{ opacity: 0.3, marginBottom: "0.5rem" }} />
            <p style={{ margin: 0, fontSize: "0.8125rem" }}>Click &quot;Test Prompt with AI&quot; to see results here</p>
          </div>
        )}

        {/* Test Result */}
        {testResult && (
          <div>
            <div
              style={{
                padding: "1rem",
                background: "rgba(34, 197, 94, 0.1)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                borderRadius: "8px",
                marginBottom: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <h4 style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, color: "rgba(34, 197, 94, 1)" }}>
                  AI Response
                </h4>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <span>
                    <strong>Provider:</strong> {testResult.provider}
                  </span>
                  <span>
                    <strong>Model:</strong> {testResult.model}
                  </span>
                  <span>
                    <strong>Suggestions:</strong> {testResult.suggestions.length}
                  </span>
                </div>
              </div>
              {testResult.suggestions.length > 0 && (
                <div style={{ marginBottom: "1rem" }}>
                  <h5 style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Suggestions:
                  </h5>
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    {testResult.suggestions.map((suggestion, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "0.75rem",
                          background: "rgba(15, 23, 42, 0.05)",
                          borderRadius: "6px",
                          border: "1px solid rgba(34, 197, 94, 0.2)",
                        }}
                      >
                        {suggestion.title && (
                          <div style={{ fontWeight: 600, marginBottom: "0.25rem", fontSize: "0.8125rem" }}>
                            {suggestion.title}
                          </div>
                        )}
                        <div style={{ fontSize: "0.8125rem", color: "var(--color-text-primary)", lineHeight: "1.5" }}>
                          {suggestion.content}
                        </div>
                        {suggestion.type && (
                          <div style={{ fontSize: "0.625rem", color: "var(--color-text-secondary)", marginTop: "0.25rem" }}>
                            Type: {suggestion.type}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {testResult.raw_output && (
                <div>
                  <h5 style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Raw Output:
                  </h5>
                  <pre
                    style={{
                      padding: "0.75rem",
                      background: "rgba(15, 23, 42, 0.1)",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontFamily: "monospace",
                      overflowX: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      maxHeight: "400px",
                      overflowY: "auto",
                      margin: 0,
                    }}
                  >
                    {testResult.raw_output}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Test Error */}
        {testError && (
          <div
            style={{
              padding: "0.75rem",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "6px",
            }}
          >
            <div style={{ display: "flex", alignItems: "start", gap: "0.5rem" }}>
              <MsqdxIcon name="error" customSize={18} style={{ color: "rgba(239, 68, 68, 1)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 0.25rem", fontSize: "0.8125rem", fontWeight: 600, color: "rgba(239, 68, 68, 1)" }}>
                  Test Failed:
                </p>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "rgba(239, 68, 68, 0.9)" }}>{testError}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

