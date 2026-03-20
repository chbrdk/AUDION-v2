import {
    getImagePaintsFromLayer,
    stripInvalidImageTransportKeys,
} from "./sanitize-paints";

describe("sanitize-paints", () => {
    it("collects IMAGE paints from backgrounds", () => {
        const layer = {
            backgrounds: [{ type: "IMAGE", base64: "QQ==" }],
        };
        expect(getImagePaintsFromLayer(layer)).toHaveLength(1);
    });

    it("stripInvalidImageTransportKeys removes base64 and drops IMAGE without imageHash", () => {
        const layer = {
            fills: [
                { type: "IMAGE", base64: "abc", scaleMode: "FILL" },
                { type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } },
            ],
        };
        stripInvalidImageTransportKeys(layer);
        expect(layer.fills).toHaveLength(1);
        expect((layer.fills![0] as { type: string }).type).toBe("SOLID");
    });

    it("keeps IMAGE when imageHash is set", () => {
        const layer = {
            fills: [{ type: "IMAGE", imageHash: "abc123", scaleMode: "FILL" }],
        };
        stripInvalidImageTransportKeys(layer);
        expect(layer.fills).toHaveLength(1);
    });
});
