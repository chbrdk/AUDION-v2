import { describe, expect, it } from "vitest";
import { mirrorFillStringPair } from "./bilingual-mirror";

describe("mirrorFillStringPair", () => {
  it("copes DE from EN when DE is empty", () => {
    expect(mirrorFillStringPair("Hello", "")).toEqual({ en: "Hello", de: "Hello" });
    expect(mirrorFillStringPair("Hello", "   ")).toEqual({ en: "Hello", de: "Hello" });
  });

  it("copies EN from DE when EN is empty", () => {
    expect(mirrorFillStringPair("", "Hallo")).toEqual({ en: "Hallo", de: "Hallo" });
  });

  it("leaves both unchanged when both set or both empty", () => {
    expect(mirrorFillStringPair("a", "b")).toEqual({ en: "a", de: "b" });
    expect(mirrorFillStringPair("", "")).toEqual({ en: "", de: "" });
  });
});
