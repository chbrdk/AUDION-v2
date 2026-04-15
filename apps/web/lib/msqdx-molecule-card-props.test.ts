import type { MsqdxMoleculeCardProps } from "@msqdx/react";
import type { ReactNode } from "react";
import { describe, it, expectTypeOf } from "vitest";

/**
 * Regression: persona list cards used JSX in `subtitle`, but MsqdxMoleculeCard
 * (MsqdxCard) types `subtitle` as string only. Rich rows belong in `chips`.
 */
describe("MsqdxMoleculeCard props contract", () => {
  it("types subtitle as string | undefined and chips as ReactNode", () => {
    expectTypeOf<MsqdxMoleculeCardProps["subtitle"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<MsqdxMoleculeCardProps["chips"]>().toEqualTypeOf<ReactNode | undefined>();
  });
});
