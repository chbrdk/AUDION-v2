import { getImageFills } from "./utils";

describe("getImageFills", () => {
    it("returns false when no fills", () => {
        expect(getImageFills({})).toBe(false);
        expect(getImageFills({ fills: undefined })).toBe(false);
    });

    it("returns false when fills is not an array", () => {
        expect(getImageFills({ fills: "nope" as unknown as [] })).toBe(false);
    });

    it("returns IMAGE paints for FRAME-like layers", () => {
        const layer = {
            type: "FRAME",
            fills: [
                { type: "SOLID", color: { r: 1, g: 1, b: 1 } },
                { type: "IMAGE", base64: "abc", scaleMode: "FILL" },
            ],
        };
        const imgs = getImageFills(layer);
        expect(imgs).not.toBe(false);
        expect((imgs as unknown[]).length).toBe(1);
        expect((imgs as { type: string }[])[0].type).toBe("IMAGE");
    });

    it("includes IMAGE paints from backgrounds", () => {
        const layer = {
            type: "FRAME",
            fills: [],
            backgrounds: [{ type: "IMAGE", base64: "x", scaleMode: "FILL" }],
        };
        const imgs = getImageFills(layer);
        expect(imgs).not.toBe(false);
        expect((imgs as unknown[]).length).toBe(1);
    });
});
