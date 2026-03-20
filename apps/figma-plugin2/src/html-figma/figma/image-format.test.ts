import { isSupportedFigmaImageBytes } from "./image-format";

describe("isSupportedFigmaImageBytes", () => {
    it("accepts PNG/JPEG/GIF/BMP", () => {
        expect(
            isSupportedFigmaImageBytes(
                new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
            )
        ).toBe(true);
        expect(
            isSupportedFigmaImageBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xdb]))
        ).toBe(true);
        expect(
            isSupportedFigmaImageBytes(
                new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
            )
        ).toBe(true);
        expect(
            isSupportedFigmaImageBytes(new Uint8Array([0x42, 0x4d, 0x00, 0x00]))
        ).toBe(true);
    });

    it("rejects WEBP/SVG/HTML-ish bytes", () => {
        // RIFF....WEBP
        expect(
            isSupportedFigmaImageBytes(
                new Uint8Array([
                    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
                ])
            )
        ).toBe(false);
        // "<svg"
        expect(
            isSupportedFigmaImageBytes(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))
        ).toBe(false);
        // "<!DO" / html-like
        expect(
            isSupportedFigmaImageBytes(new Uint8Array([0x3c, 0x21, 0x44, 0x4f]))
        ).toBe(false);
    });
});
