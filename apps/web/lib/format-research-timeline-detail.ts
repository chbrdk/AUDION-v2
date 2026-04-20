/** Secondary line for project research timeline rows (message vs structured payload). */

export type ResearchTimelineEventLike = {
    type: string;
    message?: unknown;
    payload?: { error?: unknown; url?: unknown } | null;
};

export function formatResearchTimelineDetail(e: ResearchTimelineEventLike): string {
    if (e.type === "run_failed") {
        const err = e.payload && typeof e.payload === "object" && e.payload !== null ? e.payload.error : undefined;
        if (typeof err === "string" && err.trim()) return err;
    }
    if (e.type === "page_fetched") {
        const url = e.payload && typeof e.payload === "object" && e.payload !== null ? e.payload.url : undefined;
        if (typeof url === "string" && url) return url;
    }
    return typeof e.message === "string" ? e.message : "";
}
