import { describe, expect, it } from "vitest";
import { processStream } from "./stream-processor";

function streamFromString(data: string) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(data));
      controller.close();
    },
  });
}

describe("processStream", () => {
  it("calls onReasoningDelta for reasoning_delta chunks", async () => {
    const reasoning: string[] = [];
    const deltas: string[] = [];
    const sse =
      'data: {"type":"reasoning_delta","delta":"think"}\n\n' +
      'data: {"type":"delta","delta":"Hello"}\n\n' +
      'data: {"type":"complete"}\n\n';
    const reader = streamFromString(sse).getReader();
    await processStream(reader, {
      onDelta: (d) => deltas.push(d),
      onReasoningDelta: (d) => reasoning.push(d),
      onSources: () => {},
      onComplete: () => {},
      onError: () => {},
      setSending: () => {},
      setThinkingLabel: () => {},
    });
    expect(reasoning.join("")).toBe("think");
    expect(deltas.join("")).toBe("Hello");
  });
});
