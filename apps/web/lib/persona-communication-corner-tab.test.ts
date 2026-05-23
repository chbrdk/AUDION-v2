import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveChipEditorCornerTabStyle } from "./chip-editor-corner-tab";
import {
  COMMUNICATION_SENTENCE_CHIP_PROPS,
  COMMUNICATION_VOCABULARY_CHIP_PROPS,
} from "./persona-communication-chip-layout";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("persona communication vocabulary corner tab", () => {
  it("enables corner-tab shell via vocab variant and relaxed grid props", () => {
    expect(resolveChipEditorCornerTabStyle("vocab")?.iconColor).toContain("blue");
    expect(COMMUNICATION_VOCABULARY_CHIP_PROPS.chipLayout).toBe("grid");
    expect(COMMUNICATION_VOCABULARY_CHIP_PROPS.relaxedSpacing).toBe(true);
    expect(COMMUNICATION_VOCABULARY_CHIP_PROPS.cornerTabPlacement).toBe("top-right");
  });

  it("enables corner-tab shell for sentence structure", () => {
    expect(resolveChipEditorCornerTabStyle("sentence")?.iconColor).toContain("blue");
    expect(COMMUNICATION_SENTENCE_CHIP_PROPS.chipLayout).toBe("grid");
    expect(COMMUNICATION_SENTENCE_CHIP_PROPS.relaxedSpacing).toBe(true);
  });

  it("documents communication variants in chip-editor-corner-tab icons", () => {
    const source = readFileSync(join(webRoot, "lib/chip-editor-corner-tab.tsx"), "utf8");
    expect(source).toContain('vocab: "chat_bubble"');
    expect(source).toContain('sentence: "format_quote"');
  });
});
