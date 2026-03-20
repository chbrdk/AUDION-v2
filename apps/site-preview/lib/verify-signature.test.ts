import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyHmacSha256Hex } from "./verify-signature";

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

describe("verifyHmacSha256Hex", () => {
  it("accepts matching signature", () => {
    const secret = "a".repeat(32);
    const body = '{"jobId":"x","pageSpec":{}}';
    const sig = sign(body, secret);
    expect(verifyHmacSha256Hex(body, sig, secret)).toBe(true);
  });

  it("rejects wrong secret", () => {
    const body = "{}";
    const sig = sign(body, "a".repeat(32));
    expect(verifyHmacSha256Hex(body, sig, "b".repeat(32))).toBe(false);
  });

  it("rejects missing signature", () => {
    expect(verifyHmacSha256Hex("{}", null, "a".repeat(32))).toBe(false);
  });
});
