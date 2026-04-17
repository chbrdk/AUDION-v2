import { describe, it, expect } from "vitest";
import { glassChatPanelMessagesStackSx } from "./glass-chat-panel-layout";

describe("glassChatPanelMessagesStackSx", () => {
  it("keeps md+ bottom padding for end-of-thread scroll clearance", () => {
    expect(glassChatPanelMessagesStackSx).toMatchObject({
      pb: { md: "100px" },
    });
  });
});
