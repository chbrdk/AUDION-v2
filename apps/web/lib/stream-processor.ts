// Stream processor isolated from component to avoid closure issues

export interface StreamCallbacks {
  onDelta: (delta: string) => void;
  onReasoningDelta?: (delta: string) => void;
  onSources: (sources: Array<{
    chunk_id: string;
    document_id: string;
    title: string;
    confidence: number;
    excerpt: string;
  }>) => void;
  onAudioChunk?: (audio: string, mimeType: string) => void;
  onComplete: () => void;
  onError: (error: string) => void;
  setSending: (sending: boolean) => void;
  setThinkingLabel: (label: string | undefined) => void;
}

export async function processStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: StreamCallbacks
): Promise<string | null> {
  const decoder = new TextDecoder();
  let buffer = "";
  let hasReceivedData = false;
  let streamStarted = false;
  let streamError: string | null = null;

  while (true) {
    const readResult = await reader.read();
    if (readResult.done) {
      if (!hasReceivedData) {
        streamError = "Stream ended without any data";
      }
      break;
    }

    hasReceivedData = true;
    buffer += decoder.decode(readResult.value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      if (!line.startsWith("data: ")) continue;

      let parsedData: any = null;
      const jsonStr = line.slice(6);
      try {
        parsedData = JSON.parse(jsonStr);
      } catch {
        continue;
      }

      if (!parsedData) continue;

      if (!streamStarted) {
        streamStarted = true;
        callbacks.setSending(false);
      }

      if (parsedData.type === "delta") {
        if (parsedData.delta) {
          callbacks.onDelta(parsedData.delta);
        }
        if (callbacks.onAudioChunk && parsedData.audio) {
          callbacks.onAudioChunk(parsedData.audio, parsedData.mime_type ?? "audio/mpeg");
        }
      } else if (parsedData.type === "reasoning_delta" && parsedData.delta) {
        callbacks.onReasoningDelta?.(parsedData.delta);
      } else if (parsedData.type === "sources") {
        const normalizedSources = (parsedData.sources || []).map((source: any, index: number) => ({
          chunk_id: source.chunk_id ?? `chunk-${index}`,
          document_id: source.document_id ?? "Unknown",
          title: source.title ?? "Research",
          confidence: typeof source.confidence === "number" ? source.confidence : 0.8,
          excerpt: source.content ?? "",
        }));
        callbacks.onSources(normalizedSources);
      } else if (parsedData.type === "complete") {
        callbacks.onComplete();
      } else if (parsedData.type === "error") {
        const errVal = parsedData.error;
        streamError = typeof errVal === "string" ? errVal : String(errVal || "Failed to get response");
        break;
      }
    }

    if (streamError) {
      break;
    }
  }

  return streamError;
}

