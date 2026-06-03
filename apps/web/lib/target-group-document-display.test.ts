import { describe, expect, it } from "vitest";
import { documentIngestionChip, formatDocumentSize } from "./target-group-document-display";

describe("target-group-document-display", () => {
  it("maps ingestion status to chip config", () => {
    expect(
      documentIngestionChip({ ingestionStatus: "completed" }, {
        indexed: "Indexed",
        processing: (p) => `${p}%`,
        error: "Error",
        pending: "Pending",
      })
    ).toEqual({ label: "Indexed", brandColor: "green" });
  });

  it("formats file sizes", () => {
    expect(formatDocumentSize(512)).toBe("512 B");
    expect(formatDocumentSize(2048)).toBe("2.0 KB");
  });
});
