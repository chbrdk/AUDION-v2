/**
 * Decode base64 to bytes.
 *
 * In some Figma plugin runtimes `atob` may be missing/undefined, so we provide
 * a small pure-JS fallback decoder.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
    const clean = base64.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    // Pad to a multiple of 4 (base64 decoder expects this)
    const padded =
        clean.length % 4 === 0 ? clean : clean + "=".repeat(4 - (clean.length % 4));

    if (typeof atob === "function") {
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    // Fallback base64 decode (RFC4648 standard alphabet)
    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const lookup = new Int16Array(256);
    lookup.fill(-1);
    for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

    const input = padded;
    let buffer = 0;
    let bits = 0;
    const out: number[] = [];

    for (let i = 0; i < input.length; i++) {
        const c = input.charCodeAt(i);
        if (c === 61 /* '=' */) break;
        const val = lookup[c];
        if (val < 0) continue; // ignore non-alphabet chars
        buffer = (buffer << 6) | val;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out.push((buffer >> bits) & 0xff);
        }
    }

    return new Uint8Array(out);
}
