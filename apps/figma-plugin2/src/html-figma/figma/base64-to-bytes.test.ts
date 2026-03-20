import { base64ToUint8Array } from "./base64-to-bytes";

describe("base64ToUint8Array", () => {
    it("decodes a 1x1 PNG payload", () => {
        const b64 =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        const u8 = base64ToUint8Array(b64);
        expect(u8[0]).toBe(0x89);
        expect(u8[1]).toBe(0x50);
        expect(u8[2]).toBe(0x4e);
        expect(u8[3]).toBe(0x47);
    });
});
