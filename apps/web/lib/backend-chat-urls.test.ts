import { describe, expect, it } from "vitest";
import { buildChatDocumentsUploadUrl } from "../app/api/_lib/backend";

describe("buildChatDocumentsUploadUrl", () => {
  it("appends documents/upload when base ends with /chat", () => {
    expect(buildChatDocumentsUploadUrl("https://x.test/api/chat")).toBe(
      "https://x.test/api/chat/documents/upload"
    );
  });

  it("inserts /chat when base is service root", () => {
    expect(buildChatDocumentsUploadUrl("http://chat-api:8001")).toBe(
      "http://chat-api:8001/chat/documents/upload"
    );
  });
});
