import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("chat image lightbox", () => {
  it("adds a Dialog-based lightbox to the chat panel", () => {
    const src = readFileSync(join(webRoot, "components/msqdx-glass-chat-panel.tsx"), "utf8");
    expect(src).toContain("Dialog");
    expect(src).toContain("lightboxOpen");
    expect(src).toContain("openLightbox");
  });

  it("makes message images clickable (zoom-in cursor + onClick)", () => {
    const src = readFileSync(join(webRoot, "components/msqdx-glass-chat-panel.tsx"), "utf8");
    expect(src).toContain("cursor: \"zoom-in\"");
    expect(src).toContain("onClick={() => openLightbox");
  });
});

