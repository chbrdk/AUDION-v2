import type { MsqdxMoleculeCardProps } from "@msqdx/react";
import { describe, it, expectTypeOf } from "vitest";

/**
 * Regression: persona list cards used JSX in `subtitle`, but MsqdxMoleculeCard
 * (MsqdxCard) types `subtitle` as string only. Rich rows belong in `chips`.
 */
describe("MsqdxMoleculeCard props contract", () => {
  it("types subtitle as string | undefined (rich UI uses chips, not subtitle)", () => {
    expectTypeOf<MsqdxMoleculeCardProps["subtitle"]>().toEqualTypeOf<string | undefined>();
  });
});
