import { describe, expect, it } from "vitest";
import { sortMoodboardTiles } from "./moodboard";

describe("sortMoodboardTiles", () => {
  it("sorts by order ascending and defaults missing to 0", () => {
    const out = sortMoodboardTiles([
      { id: "b", order: 2 },
      { id: "a", order: 1 },
      { id: "z" },
    ] as any);
    expect(out.map((x: any) => x.id)).toEqual(["z", "a", "b"]);
  });
});

