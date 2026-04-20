import { describe, expect, it } from "vitest";

import { formatResearchTimelineDetail } from "./format-research-timeline-detail";

describe("formatResearchTimelineDetail", () => {
    it("prefers payload.error for run_failed", () => {
        expect(
            formatResearchTimelineDetail({
                type: "run_failed",
                message: "Research run failed.",
                payload: { error: "OpenAI API key not configured. Set OPENAI_API_KEY for project research." },
            })
        ).toBe("OpenAI API key not configured. Set OPENAI_API_KEY for project research.");
    });

    it("falls back to message when run_failed has no payload error", () => {
        expect(
            formatResearchTimelineDetail({
                type: "run_failed",
                message: "Research run failed.",
                payload: {},
            })
        ).toBe("Research run failed.");
    });

    it("uses page URL for page_fetched", () => {
        expect(
            formatResearchTimelineDetail({
                type: "page_fetched",
                message: "Fetched page 1/5",
                payload: { url: "https://example.com/a" },
            })
        ).toBe("https://example.com/a");
    });
});
