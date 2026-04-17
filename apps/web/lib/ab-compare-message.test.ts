import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("A/B compare message flagging", () => {
  it("sets ab_compare on the outgoing user message when enabled with exactly two pending images", () => {
    const chatPage = readFileSync(join(webRoot, "app/admin/chat/page.tsx"), "utf8");
    expect(chatPage).toContain("if (abCompareNextMessage && pendingImageIds.length === 2)");
    expect(chatPage).toContain("userMessage.ab_compare = true");
  });

  it("shows an A/B compare checkbox only when exactly two pending images are present", () => {
    const chatPage = readFileSync(join(webRoot, "app/admin/chat/page.tsx"), "utf8");
    expect(chatPage).toContain("pendingImageIds.length === 2");
    expect(chatPage).toContain("A/B compare");
  });
});

