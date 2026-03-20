/**
 * Figma createImage only accepts a subset of raster formats.
 * Detect by magic bytes to skip unsupported payloads (webp/avif/svg/html, ...).
 */
export function isSupportedFigmaImageBytes(bytes: Uint8Array): boolean {
    if (!bytes || bytes.length < 4) return false;

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
    ) {
        return true;
    }

    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return true;
    }

    // GIF: GIF87a / GIF89a
    if (
        bytes.length >= 6 &&
        bytes[0] === 0x47 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x38 &&
        (bytes[4] === 0x37 || bytes[4] === 0x39) &&
        bytes[5] === 0x61
    ) {
        return true;
    }

    // BMP: "BM"
    if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
        return true;
    }

    return false;
}
