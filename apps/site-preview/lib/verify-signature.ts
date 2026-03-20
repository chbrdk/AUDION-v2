import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyHmacSha256Hex(body: string, signatureHex: string | null, secret: string): boolean {
  if (!secret || !signatureHex) return false;
  const expected = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signatureHex.trim(), "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
